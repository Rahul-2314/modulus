import { Router } from "express";
import { prisma } from "../lib/db";
import { requireSession } from "../middleware/session";
import { assertProjectAccess } from "../lib/authz";

export const dashboardRouter = Router();
dashboardRouter.use(requireSession);

const ESTIMATED_MINUTES_SAVED_PER_MERGED_FIX = 45;

dashboardRouter.get("/:projectId", async(req, res, next) => {
    try {
        await assertProjectAccess(req.user!.id, req.params.projectId);
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const {projectId} = req.params;

        const [executionStats, incidentCounts, prTotal, prMerged] =
			await Promise.all([
				prisma.execution.groupBy({
					by: ["status"],
					where: { agent: { projectId }, createdAt: { gte: since } },
					_count: true,
				}),
                prisma.incident.groupBy({by: ["status"], where: {projectId}, _count: true}),
                prisma.pullRequest.count({where: {fix: {incident: {projectId}}}}),
                prisma.pullRequest.count({where: {fix: {incident: {projectId}}, status: "merged"}}),
			]);

        const totalExecutions = executionStats.reduce((sum, s) => sum + s._count, 0);
        const succeeded = executionStats.find((s) => s.status === "succeeded")?._count ?? 0;

        res.json({
			success: true,
			data: {
				windowDays: 30,
				executionVolume: totalExecutions,
				successRate:
					totalExecutions > 0 ? succeeded / totalExecutions : null,
				incidents: {
					open:
						incidentCounts.find((i) => i.status === "open")?._count ?? 0,
					acknowledged:
						incidentCounts.find((i) => i.status === "acknowledged")
							?._count ?? 0,
					resolved:
						incidentCounts.find((i) => i.status === "resolved")?._count ??
						0,
				},
				pullRequests: {
					total: prTotal,
					merged: prMerged,
					acceptanceRate: prTotal > 0 ? prMerged / prTotal : null,
				},
				estimatedTimeSavedMinutes:
					prMerged * ESTIMATED_MINUTES_SAVED_PER_MERGED_FIX,
				assumptionNote: `Assumes ${ESTIMATED_MINUTES_SAVED_PER_MERGED_FIX} minutes of manual debugging avoided per merged fix.`,
			},
		});
    } catch (err) {
        next(err);
    }
});