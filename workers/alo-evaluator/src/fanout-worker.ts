import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { aloEvaluationQueue } from "@modulus/queues";

const connection = { url: process.env.REDIS_URL! };

export const aloFanoutWorker = new Worker(
	"alo-scheduler",
	async () => {
		const objectives = await prisma.agentLevelObjective.findMany({
			where: { enabled: true },
			select: { id: true },
		});
		for (const o of objectives)
			await aloEvaluationQueue.add("evaluate-objective", { objectiveId: o.id });
	},
	{ connection },
);
