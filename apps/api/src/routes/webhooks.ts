import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "../lib/db";
import { decrypt } from "@modulus/crypto";

export const webhooksRouter = Router();

type GithubPayload = {
	repository?: { html_url?: unknown };
	pull_request?: { merged?: unknown; state?: unknown; number?: unknown };
};

webhooksRouter.post("/github", async (req, res) => {
	const signature = req.header("x-hub-signature-256");
	const event = req.header("x-github-event");
	const rawBody = req.body as Buffer; // populated by express.raw()

	if (!signature)
		return res
			.status(401)
			.json({ success: false, error: { code: "MISSING_SIGNATURE" } });

	let payload: GithubPayload;
	try {
		payload = JSON.parse(rawBody.toString("utf-8"));
	} catch {
		return res
			.status(400)
			.json({ success: false, error: { code: "INVALID_PAYLOAD" } });
	}

	const repositoryUrl = payload.repository?.html_url;
	if (typeof repositoryUrl !== "string" || !repositoryUrl)
		return res
			.status(400)
			.json({ success: false, error: { code: "MISSING_REPOSITORY" } });

	const project = await prisma.project.findFirst({ where: { repositoryUrl } });
	if (!project?.githubWebhookSecretEncrypted) {
		return res
			.status(404)
			.json({ success: false, error: { code: "UNKNOWN_REPOSITORY" } });
	}

	const secret = decrypt(project.githubWebhookSecretEncrypted);
	const expected =
		"sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

	const sigBuf = Buffer.from(signature);
	const expectedBuf = Buffer.from(expected);

	// requires equal-length buffers and short circuits unsafely
	const valid =
		sigBuf.length === expectedBuf.length &&
		timingSafeEqual(sigBuf, expectedBuf);
	if (!valid)
		return res
			.status(401)
			.json({ success: false, error: { code: "INVALID_SIGNATURE" } });

	if (
		event === "pull-request" &&
		payload.pull_request &&
		typeof payload.pull_request.number === "number"
	) {
		const status = payload.pull_request.merged
			? "merged"
			: payload.pull_request.state === "closed"
				? "closed"
				: "open";
		await prisma.pullRequest.updateMany({
			where: {
				repository: repositoryUrl,
				prNumber: payload.pull_request.number,
			},
			data: { status },
		});
	}

	res.status(200).json({ success: true, data: { received: true } });
});
