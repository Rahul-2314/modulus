import "@modulus/config";
import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { rules } from "./rules/index.js";
import { instrumentWorkerMetrics } from "@modulus/queues/metrics";
import { linkFindingToIncident } from "@modulus/incident-engine";

const connection = { url: process.env.REDIS_URL! };

export const detectorWorker = new Worker(
	"detection",
	async (job) => {
		const { projectId, executionId } = job.data as {
			projectId: string;
			executionId: string;
		};

		const execution = await prisma.execution.findUnique({
			where: { id: executionId },
			include: { toolCalls: true, events: true, agent: true },
		});
		if (!execution) return; // execution row can lag briefly behind the enqueue — safe to no-op

		const ctx = {
			execution,
			toolCalls: execution.toolCalls,
			events: execution.events,
			agent: execution.agent,
		};
		const findings = rules
			.map((rule) => rule.evaluate(ctx))
			.filter((f): f is NonNullable<typeof f> => f !== null);

		for (const finding of findings) {
			await linkFindingToIncident({
				projectId,
				ruleId: finding.ruleId,
				title: finding.title,
				severity: finding.severity,
				executionId,
			});
		}
	},
	{ connection, concurrency: 10 },
);

// worker metrics
instrumentWorkerMetrics(detectorWorker, "detector");
