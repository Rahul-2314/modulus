import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ingestPayloadSchema } from "@modulus/otel-core/schema";
import { requireApiKey } from "../middleware/apiKeyAuth";
import { ingestionQueue } from "../lib/queues";

export const ingestRouter = Router();

// Per-API-key rate limit, per §11 scalability principles.
const ingestLimiter = rateLimit({
	windowMs: 60_000,
	limit: 300,
	keyGenerator: (req) => req.project?.id ?? req.ip,
});

ingestRouter.use(requireApiKey, ingestLimiter);

ingestRouter.post("/traces", async (req, res, next) => {
	try {
		const payload = ingestPayloadSchema.parse(req.body); // bounded batch size enforced in schema

		await ingestionQueue.add(
			"process-trace",
			{ projectId: req.project!.id, payload },
			{ attempts: 5, backoff: { type: "exponential", delay: 2000 } },
		);

		// Return immediately — do not wait on normalization/storage. This is the
		// non-blocking guarantee from §5: a slow or failing worker must never
		// stall the customer's agent.
		res.status(202).json({ success: true, data: { accepted: true } });
	} catch (err) {
		next(err);
	}
});
