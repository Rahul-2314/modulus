import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { normalizeIngestPayload } from "@modulus/otel-core/normalize";
import { ingestPayloadSchema } from "@modulus/otel-core/schema";
import { redact } from "@modulus/otel-core/redact";

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

		const agent = await prisma.agent.upsert({
			where: { projectId_name: { projectId, name: normalized.agentName } },
			create: {
				projectId,
				name: normalized.agentName,
				framework: normalized.framework,
				adapterVersion: normalized.adapterVersion,
			},
			update: {
				framework: normalized.framework,
				adapterVersion: normalized.adapterVersion,
			},
		});

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
			},
			update: { status: normalized.status, endedAt: normalized.endedAt },
		});

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
	},
	{ connection, concurrency: 10 },
);

ingestionWorker.on("failed", (job, err) => {
	console.error(`ingestion job ${job?.id} failed`, err);
});
