import { Router } from "express";
import { prisma } from "../lib/db";
import { requireSession } from "../middleware/session";
import { assertProjectAccess } from "../lib/authz";

export const metricsRouter = Router();
metricsRouter.use(requireSession);

metricsRouter.get("/:projectId/internal", async (req, res, next) => {
	try {
		await assertProjectAccess(req.user!.id, req.params.projectId, "admin"); // kept above member visibility
		const { projectId } = req.params;

		const [
			diagnosisCost,
			diagnosisCacheStats,
			reproductionStats,
			fixRiskStats,
			fixStatusStats,
		] = await Promise.all([
			prisma.diagnosis.aggregate({
				where: { incident: { projectId } },
				_sum: { cost: true },
			}),
			prisma.diagnosis.groupBy({
				by: ["cacheHit"],
				where: { incident: { projectId } },
				_count: true,
			}),
			prisma.reproduction.groupBy({
				by: ["status"],
				where: { incident: { projectId } },
				_count: true,
			}),
			prisma.fix.groupBy({
				by: ["riskLevel"],
				where: { incident: { projectId } },
				_count: true,
			}),
			prisma.fix.groupBy({
				by: ["status"],
				where: { incident: { projectId } },
				_count: true,
			}),
		]);

		const totalDiagnoses = diagnosisCacheStats.reduce(
			(s, d) => s + d._count,
			0,
		);
		const cacheHits = diagnosisCacheStats.find((d) => d.cacheHit)?._count ?? 0;
		const totalReproductions = reproductionStats.reduce(
			(s, r) => s + r._count,
			0,
		);
		const reproduced =
			reproductionStats.find((r) => r.status === "reproduced")?._count ?? 0;

		res.json({
			success: true,
			data: {
				diagnosisCostUsd: diagnosisCost._sum.cost ?? 0,
				diagnosisCacheHitRate:
					totalDiagnoses > 0 ? cacheHits / totalDiagnoses : null,
				reproductionConfirmationRate:
					totalReproductions > 0 ? reproduced / totalReproductions : null,
				fixRiskDistribution: Object.fromEntries(
					fixRiskStats.map((f) => [f.riskLevel, f._count]),
				),
				fixStatusFunnel: Object.fromEntries(
					fixStatusStats.map((f) => [f.status, f._count]),
				),
			},
		});
	} catch (err) {
		next(err);
	}
});
