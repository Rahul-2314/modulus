import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireSession } from "../middleware/session";
import { assertProjectAccess } from "../lib/authz";
import { ApiError } from "../lib/errors";

export const aloRouter = Router();
aloRouter.use(requireSession);

const createSchema = z.object({
  agentId: z.uuid(),
  metricType: z.enum(["task_success_rate", "tool_reliability", "cost_per_task", "completion_latency_p95", "loop_rate"]),
  comparator: z.enum(["gte", "lte"]),
  targetValue: z.number(),
  windowDays: z.number().int().min(1).max(90).default(7),
});

aloRouter.post("/", async (req, res, next) => {
	try {
		const body = createSchema.parse(req.body);
		const agent = await prisma.agent.findUnique({
			where: { id: body.agentId },
		});
		if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found");
		await assertProjectAccess(req.user!.id, agent.projectId, "admin");

		const objective = await prisma.agentLevelObjective.upsert({
			where: {
				agentId_metricType: {
					agentId: body.agentId,
					metricType: body.metricType,
				},
			},
			create: body,
			update: {
				comparator: body.comparator,
				targetValue: body.targetValue,
				windowDays: body.windowDays,
				enabled: true,
			},
		});
		res.status(201).json({ success: true, data: objective });
	} catch (err) {
		next(err);
	}
});

aloRouter.get("/", async (req, res, next) => {
	try {
		const agentId = z.string().uuid().parse(req.query.agentId);
		const agent = await prisma.agent.findUnique({ where: { id: agentId } });
		if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found");
		await assertProjectAccess(req.user!.id, agent.projectId);

		const objectives = await prisma.agentLevelObjective.findMany({
			where: { agentId },
			include: { evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } }, // latest evaluation = current scorecard state
		});
		res.json({ success: true, data: objectives });
	} catch (err) {
		next(err);
	}
});

