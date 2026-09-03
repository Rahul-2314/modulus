import "@modulus/config";
import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { instrumentWorkerMetrics } from "@modulus/queues/metrics";

const connection = { url: process.env.REDIS_URL! };

export const retentionWorker = new Worker(
	"retention",
	async () => {
		const projects = await prisma.project.findMany({
			select: { id: true, dataRetentionDays: true },
		});

		for (const project of projects) {
			const cutoff = new Date(
				Date.now() - project.dataRetentionDays * 24 * 60 * 60 * 1000,
			);

			// Deleting Execution cascades to ExecutionEvent, ToolCall, and
			// IncidentExecution (onDelete: Cascade, set since Day 3/4) — no
			// separate cleanup needed. Incidents/Diagnoses/Fixes are NOT purged:
			// they're small, derived summaries with lasting value; raw traces are
			// the large, potentially-sensitive data retention is meant to bound.
			const { count } = await prisma.execution.deleteMany({
				where: { agent: { projectId: project.id }, createdAt: { lt: cutoff } },
			});

			if (count > 0)
				console.log(
					`retention: purged ${count} executions for project ${project.id}`,
				);
		}
	},
	{ connection },
);

// worker metrics
instrumentWorkerMetrics(retentionWorker, "retention");

