import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { ApiError } from "../lib/errors.js";
import { requireSession } from "../middleware/session.js";
import { assertProjectAccess } from "../lib/authz.js";
import { diagnosisQueue } from "@modulus/queues";
import { reproductionQueue } from "@modulus/queues";
import { fixQueue } from "@modulus/queues";
import { audit } from "../lib/audit.js";
import { buildPaginatedResult } from "../lib/pagination.js";

export const incidentsRouter = Router();
incidentsRouter.use(requireSession);

const listQuerySchema = z.object({
	projectId: z.uuid(),
	status: z.enum(["open", "acknowledged", "resolved"]).optional(),
	severity: z.enum(["low", "medium", "high", "critical"]).optional(),
	cursor: z.string().optional(), // pagination helper
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

incidentsRouter.get("/", async (req, res, next) => {
	try {
		const query = listQuerySchema.parse(req.query);
		await assertProjectAccess(req.user!.id, query.projectId);

		const incidents = await prisma.incident.findMany({
			where: {
				projectId: query.projectId,
				...(query.status ? { status: query.status } : {}),
				...(query.severity ? { severity: query.severity } : {}),
			},
			orderBy: { id: "desc" }, // pair cursor field with orderBy field
			take: query.limit + 1,
			...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
		});

		const { items, nextCursor } = buildPaginatedResult(incidents, query.limit);
		res.json({ success: true, data: items, nextCursor });
	} catch (err) {
		next(err);
	}
});

// surfaces reproduction history
incidentsRouter.get("/:id", async (req, res, next) => {
	try {
		const incident = await prisma.incident.findUnique({
			where: { id: req.params.id },
			include: {
				executions: {
					include: {
						execution: { include: { toolCalls: true, events: true } },
					},
				},
				diagnosis: true,
				reproductions: { orderBy: { createdAt: "desc" } },

				// fetch its associated fix
				fix: {
					include: {
						testRuns: true,
						pullRequest: true,
					},
				},
			},
		});
		if (!incident) throw new ApiError(404, "NOT_FOUND", "Incident not found");
		await assertProjectAccess(req.user!.id, incident.projectId);

		res.json({ success: true, data: incident });
	} catch (err) {
		next(err);
	}
});

const patchSchema = z.object({ status: z.enum(["acknowledged", "resolved"]) });

incidentsRouter.patch("/:id", async (req, res, next) => {
	try {
		const body = patchSchema.parse(req.body);
		const incident = await prisma.incident.findUnique({
			where: { id: req.params.id },
		});
		if (!incident) throw new ApiError(404, "NOT_FOUND", "Incident not found");
		const project = await assertProjectAccess(req.user!.id, incident.projectId);

		const updated = await prisma.incident.update({
			where: { id: incident.id },
			data: { status: body.status },
		});

		// create audit log
		await audit({
			organizationId: project.organizationId,
			userId: req.user!.id,
			action: "incident_status_changed",
			resourceType: "incident",
			resourceId: incident.id,
			metadata: {
				from: incident.status,
				to: body.status,
			},
			...(req.ip !== undefined ? { ipAddress: req.ip } : {}),
		});

		res.json({ success: true, data: updated });
	} catch (err) {
		next(err);
	}
});

incidentsRouter.post("/:id/diagnose", async (req, res, next) => {
	try {
		const incident = await prisma.incident.findUnique({
			where: { id: req.params.id },
		});
		if (!incident) throw new ApiError(404, "NOT_FOUND", "Incident not found");
		await assertProjectAccess(req.user!.id, incident.projectId);

		await diagnosisQueue.add("diagnose-incident", { incidentId: incident.id });
		res.status(202).json({ success: true, data: { queued: true } });
	} catch (err) {
		next(err);
	}
});

// allows a manual re-run
incidentsRouter.post("/:id/reproduce", async (req, res, next) => {
	try {
		const incident = await prisma.incident.findUnique({
			where: { id: req.params.id },
		});
		if (!incident) throw new ApiError(404, "NOT_FOUND", "Incident not found");
		await assertProjectAccess(req.user!.id, incident.projectId);

		await reproductionQueue.add("reproduce-incident", {
			incidentId: incident.id,
		});
		res.status(202).json({ success: true, data: { queued: true } });
	} catch (err) {
		next(err);
	}
});

// fix route
incidentsRouter.post("/:id/fix", async (req, res, next) => {
	try {
		const incident = await prisma.incident.findUnique({
			where: { id: req.params.id },
		});
		if (!incident) throw new ApiError(404, "NOT_FOUND", "Incident not found");
		// Opening PRs writes to an external system
		const project = await assertProjectAccess(
			req.user!.id,
			incident.projectId,
			"admin",
		);

		await fixQueue.add("generate-fix", { incidentId: incident.id });

		// create audit log
		await audit({
			organizationId: project.organizationId,
			userId: req.user!.id,
			action: "fix_triggered",
			resourceType: "incident",
			resourceId: incident.id,

			...(req.ip !== undefined ? { ipAddress: req.ip } : {}),
		});

		res.status(202).json({ success: true, data: { queued: true } });
	} catch (err) {
		next(err);
	}
});
