import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { requireSession } from "../middleware/session";
import { assertProjectAccess } from "../lib/authz";
import { audit } from "../lib/audit";

export const githubRouter = Router();
githubRouter.use(requireSession);

const installCallbackSchema = z.object({
	installationId: z.coerce.number().int(),
	projectId: z.uuid(),
});

githubRouter.post("/install-callback", async (req, res, next) => {
	try {
		const body = installCallbackSchema.parse(req.body);
		const project = await assertProjectAccess(
			req.user!.id,
			body.projectId,
			"admin",
		);

		await prisma.project.update({
			where: { id: project.id },
			data: { githubInstallationId: body.installationId },
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

		res.json({ success: true, data: { installed: true } });
	} catch (err) {
		next(err);
	}
});
