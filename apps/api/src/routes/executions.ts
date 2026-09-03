import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { ApiError } from "../lib/errors";
import { requireSession } from "../middleware/session";
import { assertProjectAccess } from "../lib/authz";
import { buildPaginatedResult } from "../lib/pagination";

export const executionsRouter = Router();
executionsRouter.use(requireSession);

const listQuerySchema = z.object({
	projectId: z.uuid(),
	status: z.enum(["running", "succeeded", "failed"]).optional(),
	agentId: z.uuid().optional(),
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

// all executions
executionsRouter.get("/", async (req, res, next) => {
	try {
		const query = listQuerySchema.parse(req.query);
		await assertProjectAccess(req.user!.id, query.projectId);

		const executions = await prisma.execution.findMany({
			where: {
				agent: {
					projectId: query.projectId,
					...(query.agentId ? { id: query.agentId } : {}),
				},
				...(query.status ? { status: query.status } : {}),
			},
			include: {
				agent: { select: { name: true } },
				_count: { select: { toolCalls: true } },
			},
			orderBy: { id: "desc" },
			take: query.limit + 1,
			...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
		});

		const { items, nextCursor } = buildPaginatedResult(executions, query.limit);
		res.json({ success: true, data: items, nextCursor });
	} catch (err) {
		next(err);
	}
});

// executions by id
executionsRouter.get("/:id", async (req, res, next) => {
	try {
		const execution = await prisma.execution.findUnique({
			where: { id: req.params.id },
			include: {
				agent: true,
				toolCalls: true,
				events: { orderBy: { timestamp: "asc" } },
			},
		});
		if (!execution) throw new ApiError(404, "NOT_FOUND", "Execution not found");
		await assertProjectAccess(req.user!.id, execution.agent.projectId);

		res.json({ success: true, data: execution });
	} catch (err) {
		next(err);
	}
});
