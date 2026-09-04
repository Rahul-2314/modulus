import "@modulus/config";
import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { normalizeIngestPayload } from "@modulus/otel-core/normalize";
import { ingestPayloadSchema } from "@modulus/otel-core/schema";
import { redact } from "@modulus/otel-core/redact";
import { detectionQueue } from "@modulus/queues";
import { instrumentWorkerMetrics } from "@modulus/queues/metrics";

const connection = { url: process.env.REDIS_URL! };

export const ingestionWorker = new Worker(
	"ingestion",
	async (job) => {
		const { projectId, payload: rawPayload } = job.data as {
			projectId: string;
			payload: unknown;
		};
		const payload = ingestPayloadSchema.parse(rawPayload);
		const normalized = normalizeIngestPayload(payload);

		// 1. Upsert agent
		const agent = await prisma.agent.upsert({
			where: { projectId_name: { projectId, name: normalized.agentName } },
			create: {
				projectId,
				name: normalized.agentName,
				framework: normalized.framework,
				adapterVersion: normalized.adapterVersion,
				knownTools: normalized.knownTools ?? [],
			},
			update: {
				framework: normalized.framework,
				adapterVersion: normalized.adapterVersion,
				...(normalized.knownTools ? { knownTools: normalized.knownTools } : {}),
			},
		});

		// 2. Upsert execution
		// Upsert on execution id (the OTel trace id) makes this safe against
		// BullMQ's at-least-once delivery — a retried job is a no-op, not a duplicate.
		await prisma.execution.upsert({
			where: { id: normalized.executionId },
			create: {
				id: normalized.executionId,
				agentId: agent.id,
				status: normalized.status,
				startedAt: normalized.startedAt,
				endedAt: normalized.endedAt,
				commitSha: normalized.commitSha,
				costALO: normalized.costALO,
			},
			update: {
				status: normalized.status,
				endedAt: normalized.endedAt,
				...(normalized.costALO !== undefined ? { costALO: normalized.costALO } : {})
			},
		});

		// 3. Store execution events
		if (normalized.events.length) {
			await prisma.executionEvent.createMany({
				data: normalized.events.map((e) => ({
					executionId: normalized.executionId,
					type: e.type,
					timestamp: e.timestamp,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					payload: redact(e.payload) as any,
				})),
				skipDuplicates: true,
			});
		}

		// 4. Store tool calls
		if (normalized.toolCalls.length) {
			await prisma.toolCall.createMany({
				data: normalized.toolCalls.map((t) => ({
					executionId: normalized.executionId,
					toolName: t.toolName,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					arguments: redact(t.arguments) as any,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					response: t.response ? (redact(t.response) as any) : undefined,
					status: t.status,
					latencyMs: t.latencyMs,
				})),
				skipDuplicates: true,
			});
		}

		// 5. Queue execution for incident detection
		await detectionQueue.add(
			"classify-execution",
			{ projectId, executionId: normalized.executionId },
			{ attempts: 3, backoff: { type: "exponential", delay: 2000 } },
		);
	},
	{ connection, concurrency: 10 },
);

// worker metrics
instrumentWorkerMetrics(ingestionWorker, "ingestion");

ingestionWorker.on("failed", (job, err) => {
	console.error(`ingestion job ${job?.id} failed`, err);
});
