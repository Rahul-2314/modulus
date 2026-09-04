import { Router } from "express";
import Redis from "ioredis";
import { prisma } from "../lib/db";
import { qdrant } from "@modulus/vector-store/qdrant";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
	res.status(200).json({
		success: true,
		status: "ok",
	});
});

healthRouter.get("/deep", async (_req, res) => {
	const checks: Record<string, "ok" | "error"> = {};

	checks.postgres = await prisma.$queryRaw`SELECT 1`
		.then(() => "ok" as const)
		.catch(() => "error" as const);
	checks.qdrant = await qdrant
		.getCollections()
		.then(() => "ok" as const)
		.catch(() => "error" as const);
	checks.redis = await new Redis(process.env.REDIS_URL!, {
		lazyConnect: true,
		maxRetriesPerRequest: 1,
	})
		.connect()
		.then(() => "ok" as const)
		.catch(() => "error" as const);

	const healthy = Object.values(checks).every((v) => v === "ok");
	res.status(healthy ? 200 : 503).json({ success: healthy, data: checks });
});
