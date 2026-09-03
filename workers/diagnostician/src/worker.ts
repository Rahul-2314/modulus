import "@modulus/config";
import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import type { Prisma } from "@modulus/database";
import { embedText } from "@modulus/vector-store/embeddings";
import {
	ensureCollection,
	upsertIncidentVector,
	findSimilarDiagnosedIncidents,
} from "@modulus/vector-store/qdrant";
import { callDiagnosisModel } from "@modulus/llm/router";
import type { CostTier } from "@modulus/llm";
import { buildUserPrompt, SYSTEM_PROMPT } from "./context.js";
import { diagnosisResultSchema } from "./schema.js";
import { reproductionQueue } from "@modulus/queues";
import { instrumentWorkerMetrics } from "@modulus/queues/metrics";
import { resolveCostTier } from "@modulus/cost-tier";

const connection = { url: process.env.REDIS_URL! };
const SIMILARITY_THRESHOLD = 0.92; // false cache hit misattributes a root cause

await ensureCollection();

export const diagnosticianWorker = new Worker(
	"diagnosis",
	async (job) => {
		const { incidentId } = job.data as { incidentId: string };

		const incident = await prisma.incident.findUnique({
			where: { id: incidentId },
			include: {
				executions: {
					include: {
						execution: { include: { toolCalls: true, events: true } },
					},
					take: 1,
					orderBy: { createdAt: "desc" },
				},
			},
		});
		if (!incident || !incident.executions[0]) return;

		const execution = incident.executions[0].execution;
		const tier = await resolveCostTier(execution.agentId);
		const embedding = await embedText(`${incident.title}\n${incident.ruleId}`);

		// Cost control: reuse a prior diagnosis for a near-identical
		// incident instead of spending another LLM call.
		const { points } = await findSimilarDiagnosedIncidents(
			incident.projectId,
			embedding,
			1,
		);
		const [match] = points;
		if (match && match.score >= SIMILARITY_THRESHOLD) {
			const diagnosisId =
				match.payload &&
				typeof match.payload === "object" &&
				"diagnosisId" in match.payload &&
				typeof match.payload.diagnosisId === "string"
					? match.payload.diagnosisId
					: undefined;

			if (diagnosisId) {
				const cached = await prisma.diagnosis.findUnique({
					where: { id: diagnosisId },
				});
				if (cached) {
					await prisma.diagnosis.upsert({
						where: { incidentId },
						create: {
							incidentId,
							...pickDiagnosisFields(cached),
							cost: 0,
							cacheHit: true,
						},
						update: {},
					});

					return;
				}
			}
		}

		const result = await runDiagnosisWithRepair(
			buildUserPrompt({ incident, execution }),
			tier,
		);

		const diagnosis = await prisma.diagnosis.upsert({
			where: { incidentId },

			create: {
				incidentId,
				...result.data,
				model: result.model,
				provider: result.provider,
				fellBack: result.fellBack,
				cost: result.costUsd,
				cacheHit: false,
			},

			update: {
				...result.data,
				model: result.model,
				provider: result.provider,
				fellBack: result.fellBack,
				cost: result.costUsd,
				cacheHit: false,
			},
		});

		await reproductionQueue.add("reproduce-incident", { incidentId });

		await upsertIncidentVector(incidentId, embedding, {
			projectId: incident.projectId,
			incidentId,
			diagnosisId: diagnosis.id,
		});
	},
	{ connection, concurrency: 5 }, // bottleneck
);

function pickDiagnosisFields(d: {
	rootCause: string;
	confidence: number;
	affectedComponent: string;
	suggestedRemediation: string;
	evidence: unknown;
	model: string;
	provider: string;
	fellBack: boolean;
}) {
	return {
		rootCause: d.rootCause,
		confidence: d.confidence,
		affectedComponent: d.affectedComponent,
		suggestedRemediation: d.suggestedRemediation,
		evidence: d.evidence as Prisma.InputJsonValue,
		model: d.model,
		provider: d.provider,
		fellBack: d.fellBack,
	};
}

async function runDiagnosisWithRepair(userPrompt: string, tier: CostTier) {
	const first = await callDiagnosisModel(SYSTEM_PROMPT, userPrompt, { tier });

	const parsed = safeParse(first.content);

	if (parsed.success) {
		return {
			data: parsed.data,
			costUsd: first.costUsd,
			provider: first.provider,
			model: first.model,
			fellBack: first.fellBack,
		};
	}

	// Self-repair: one bounded retry.
	const repairPrompt = `${userPrompt}

Your previous response failed validation:
${parsed.error}

Respond again with ONLY the corrected JSON object.`;

	const second = await callDiagnosisModel(SYSTEM_PROMPT, repairPrompt, {
		tier,
	});

	const repaired = safeParse(second.content);

	if (repaired.success) {
		return {
			data: repaired.data,
			costUsd: first.costUsd + second.costUsd,
			provider: second.provider,
			model: second.model,
			fellBack: first.fellBack || second.fellBack,
		};
	}

	throw new Error(`Diagnosis model failed validation twice: ${repaired.error}`);
}

function safeParse(content: string) {
	try {
		const result = diagnosisResultSchema.safeParse(JSON.parse(content));
		return result.success
			? ({ success: true, data: result.data } as const)
			: ({ success: false, error: result.error.message } as const);
	} catch (err) {
		return { success: false, error: String(err) } as const;
	}
}

// worker metrics
instrumentWorkerMetrics(diagnosticianWorker, "diagnostician");
