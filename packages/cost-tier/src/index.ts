import { prisma } from "@modulus/database";
import type { CostTier } from "@modulus/llm";

export async function resolveCostTier(agentId: string): Promise<CostTier> {
	const objective = await prisma.agentLevelObjective.findUnique({
		where: {
			agentId_metricType: {
				agentId,
				metricType: "cost_per_task",
			},
		},
		include: {
			evaluations: {
				orderBy: {
					evaluatedAt: "desc",
				},
				take: 1,
			},
		},
	});

	const latestEvaluation = objective?.evaluations[0];

	return latestEvaluation?.breached ? "economy" : "standard";
}
