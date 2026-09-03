import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { Prisma } from "@modulus/database";
import { ApiError } from "../lib/errors";
import { requireSession } from "../middleware/session";
import { generateApiKey } from "../lib/apiKeys";
import { assertOrgAccess, assertProjectAccess } from "../lib/authz";
import { encrypt } from "@modulus/crypto";
import { audit } from "../lib/audit.js";
import { resolveGithubToken, fetchPullRequestStatus } from "@modulus/github";

export const projectsRouter = Router();
projectsRouter.use(requireSession);

const setTokenSchema = z.object({ token: z.string().min(10) });

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

		// create audit log
		await audit({
			organizationId: project.organizationId,
			userId: req.user!.id,
			action: "project_created",
			resourceType: "project",
			resourceId: project.id,
			...(req.ip !== undefined ? { ipAddress: req.ip } : {}),
		});

		res.status(201).json({ success: true, data: project });
	} catch (err) {
		// duplicate name project
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === "P2002"
		) {
			return next(
				new ApiError(
					409,
					"CONFLICT",
					"A project with this name already exists in this organization",
				),
			);
		}

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

		// create audit log
		await audit({
			organizationId: project.organizationId,
			userId: req.user!.id,
			action: "api_key_created",
			resourceType: "api_key",
			resourceId: apiKey.id,
			metadata: {
				projectId: project.id,
				prefix,
			},
			...(req.ip !== undefined ? { ipAddress: req.ip } : {}),
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

		// create audit log
		await audit({
			organizationId: project.organizationId,
			userId: req.user!.id,
			action: "api_key_revoked",
			resourceType: "api_key",
			resourceId: key.id,
			metadata: {
				projectId: project.id,
				prefix: key.prefix,
			},
			...(req.ip !== undefined ? { ipAddress: req.ip } : {}),
		});

		res.json({ success: true, data: null });
	} catch (err) {
		next(err);
	}
});

// allows Modulus to access GitHub
// update github token of project (connect repo)
projectsRouter.patch("/:id/github-token", async (req, res, next) => {
	try {
		const body = setTokenSchema.parse(req.body);
		const project = await assertProjectAccess(
			req.user!.id,
			req.params.id,
			"admin",
		);

		await prisma.project.update({
			where: { id: project.id },
			data: { githubTokenEncrypted: encrypt(body.token) },
		});

		// create audit log
		await audit({
			organizationId: project.organizationId,
			userId: req.user!.id,
			action: "github_token_updated",
			resourceType: "project",
			resourceId: project.id,
			...(req.ip !== undefined ? { ipAddress: req.ip } : {}),
		});

		res.json({ success: true, data: { githubTokenConfigured: true } });
	} catch (err) {
		next(err);
	}
});

// allows Manual reconciliation with GitHub
// PR status (webhook below)
projectsRouter.post("/:id/sync-prs", async (req, res, next) => {
	try {
		const project = await assertProjectAccess(req.user!.id, req.params.id);
		if (!project.repositoryUrl)
			throw new ApiError(400, "BAD_REQUEST", "No repository configured");

		const token = await resolveGithubToken(project);
		const prs = await prisma.pullRequest.findMany({
			where: {
				fix: { incident: { projectId: project.id } },
				status: { not: "merged" },
			},
		});

		for (const pr of prs) {
			if (!pr.prNumber) continue;

			const status = await fetchPullRequestStatus(
				token,
				pr.repository,
				pr.prNumber,
			);
			if (status !== pr.status)
				await prisma.pullRequest.update({
					where: { id: pr.id },
					data: { status },
				});
		}

		res.json({ success: true, data: { synced: prs.length } });
	} catch (err) {
		next(err);
	}
});

// allows GitHub to securely notify Modulus
// github pr status update
const setWebhookSecretSchema = z.object({ secret: z.string().min(10) });

projectsRouter.patch("/:id/github-webhook-secret", async (req, res, next) => {
	try {
		const body = setWebhookSecretSchema.parse(req.body);
		const project = await assertProjectAccess(
			req.user!.id,
			req.params.id,
			"admin",
		);

		await prisma.project.update({
			where: { id: project.id },
			data: { githubWebhookSecretEncrypted: encrypt(body.secret) },
		});

		// create audit log
		await audit({
			organizationId: project.organizationId,
			userId: req.user!.id,
			action: "github_token_updated",
			resourceType: "project",
			resourceId: project.id,
			...(req.ip !== undefined ? { ipAddress: req.ip } : {}),
		});

		res.json({ success: true, data: { githubWebhookConfigured: true } });
	} catch (err) {
		next(err);
	}
});




const setNotificationsSchema = z.object({
	slackWebhookUrl: z.url().optional(),
	pagerDutyIntegrationKey: z.string().min(10).optional(),
	email: z.email().optional(),
	minSeverity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

// project notifier
projectsRouter.patch("/:id/notifications", async (req, res, next) => {
  try {
    const body = setNotificationsSchema.parse(req.body);
    const project = await assertProjectAccess(req.user!.id, req.params.id, "admin");

    await prisma.project.update({
      where: { id: project.id },
      data: {
        ...(body.slackWebhookUrl ? { notificationSlackWebhookEncrypted: encrypt(body.slackWebhookUrl) } : {}),
        ...(body.pagerDutyIntegrationKey ? { notificationPagerDutyKeyEncrypted: encrypt(body.pagerDutyIntegrationKey) } : {}),
        ...(body.email ? { notificationEmail: body.email } : {}),
        ...(body.minSeverity ? { alertMinSeverity: body.minSeverity } : {}),
      },
    });
    res.json({ success: true, data: { configured: true } });
  } catch (err) {
    next(err);
  }
});