import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { linkFindingToIncident } from "@modulus/incident-engine";
import { computeMetric } from "./metrics.js";

const connection = { url: process.env.REDIS_URL! };


export const aloEvaluatorWorker = new Worker(
	"alo-evaluation",
	async (job) => {
		const { objectiveId } = job.data as { objectiveId: string };
		const objective = await prisma.agentLevelObjective.findUnique({
			where: { id: objectiveId },
			include: { agent: true },
		});
		if (!objective?.enabled) return;

		const result = await computeMetric(
			objective.agentId,
			objective.metricType,
			objective.windowDays,
		);
		if (!result) return; // not enough data — so, skip rather than record a misleading 0%

		const budgetRemaining =
			objective.comparator === "gte"? 
            result.value - objective.targetValue : objective.targetValue - result.value;
		const breached = budgetRemaining < 0;

		await prisma.aloEvaluation.create({
			data: {
				objectiveId: objective.id,
				currentValue: result.value,
				budgetRemaining,
				breached,
				sampleSize: result.sampleSize,
			},
		});

		if (breached) {
			await linkFindingToIncident({
				projectId: objective.agent.projectId,
				ruleId: `alo_breach:${objective.metricType}`,
				title: `ALO breach: ${objective.metricType} for ${objective.agent.name} (target ${objective.targetValue}, current ${result.value.toFixed(3)})`,
				severity: "high",
			});
		}
	},
	{ connection },
);