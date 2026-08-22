import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { ApiError } from "../lib/errors";
import { requireSession } from "../middleware/session";
import { generateApiKey } from "../lib/apiKeys";

export const projectsRouter = Router();
projectsRouter.use(requireSession);

async function assertOrgAccess(userId: string, organizationId: string) {
	const membership = await prisma.membership.findUnique({
		where: { userId_organizationId: { userId, organizationId } },
	});
	if (!membership)
		throw new ApiError(403, "FORBIDDEN", "No access to this organization");
	return membership;
}

const createProjectSchema = z.object({
	organizationId: z.string().uuid(),
	name: z.string().min(1),
	environment: z.string().default("development"),
});

projectsRouter.post("/", async (req, res, next) => {
	try {
		const body = createProjectSchema.parse(req.body);
		await assertOrgAccess(req.user!.id, body.organizationId);

		const project = await prisma.project.create({ data: body });
		res.status(201).json({ success: true, data: project });
	} catch (err) {
		next(err);
	}
});

projectsRouter.get("/", async (req, res, next) => {
	try {
		const memberships = await prisma.membership.findMany({
			where: { userId: req.user!.id },
		});
		const orgIds = memberships.map((m) => m.organizationId);

		const projects = await prisma.project.findMany({
			where: { organizationId: { in: orgIds } },
		});
		res.json({ success: true, data: projects });
	} catch (err) {
		next(err);
	}
});

projectsRouter.get("/:id", async (req, res, next) => {
	try {
		const project = await prisma.project.findUnique({
			where: { id: req.params.id },
		});
		if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");

		await assertOrgAccess(req.user!.id, project.organizationId);
		res.json({ success: true, data: project });
	} catch (err) {
		next(err);
	}
});

// --- API keys ---

const createKeySchema = z.object({}); // no body fields needed for MVP

projectsRouter.post("/:id/keys", async (req, res, next) => {
	try {
		createKeySchema.parse(req.body ?? {});
		const project = await prisma.project.findUnique({
			where: { id: req.params.id },
		});
		if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
		await assertOrgAccess(req.user!.id, project.organizationId);

		const { rawKey, prefix, hash } = generateApiKey();
		const apiKey = await prisma.apiKey.create({
			data: { projectId: project.id, keyHash: hash, prefix },
		});

		// Raw key is returned exactly once — the client must store it now.
		res.status(201).json({
			success: true,
			data: { id: apiKey.id, prefix, rawKey, createdAt: apiKey.createdAt },
		});
	} catch (err) {
		next(err);
	}
});

projectsRouter.delete("/:id/keys/:keyId", async (req, res, next) => {
	try {
		const project = await prisma.project.findUnique({
			where: { id: req.params.id },
		});
		if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");
		await assertOrgAccess(req.user!.id, project.organizationId);

		const key = await prisma.apiKey.findUnique({
			where: { id: req.params.keyId },
		});
		if (!key || key.projectId !== project.id)
			throw new ApiError(404, "NOT_FOUND", "API key not found");

		await prisma.apiKey.update({
			where: { id: key.id },
			data: { revokedAt: new Date() },
		});
		res.json({ success: true, data: null });
	} catch (err) {
		next(err);
	}
});
