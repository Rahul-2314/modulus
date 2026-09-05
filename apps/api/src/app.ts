import express from "express";
import "@modulus/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth/auth";
import { meRouter } from "./routes/me";
import { projectsRouter } from "./routes/projects";
import { errorHandler } from "./lib/errors";

import { incidentsRouter } from "./routes/incidents";
import { ingestRouter } from "./routes/ingest";
import { dashboardRouter } from "./routes/dashboard";
import { executionsRouter } from "./routes/executions";
import { metricsRouter } from "./routes/metrics";
import { healthRouter } from "./routes/health";
import { aloRouter } from "./routes/alo";

import { scheduleRetentionJob, schedulePlatformMonitorJob, scheduleAloEvaluationJob } from "@modulus/queues";
import { webhooksRouter } from "./routes/webhooks";
import { githubRouter } from "./routes/github";

export const app = express();

// CORS handling
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// at top before any (body-parsing middleware) (needs the raw request stream)
app.all("/api/auth/{*splat}", toNodeHandler(auth));

//  gihub pr status webhook (before the global JSON parser)
app.use(
	"/api/webhooks",
	express.raw({ type: "application/json" }),
	webhooksRouter,
);

// normal middlewares (parsers)
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

// Background Job 
scheduleRetentionJob().catch((err) => {
	console.error("Failed to schedule retention job:", err);
});
schedulePlatformMonitorJob().catch(console.error);
scheduleAloEvaluationJob().catch(console.error);

// api status check
app.get("/", (_req, res) => {
	res.json({
		success: true,
		message: "API is running",
	});
});

// application routes
app.use("/api/me", meRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/incidents", incidentsRouter);
app.use("/api/ingest", ingestRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/executions", executionsRouter);
app.use("/api/metrics", metricsRouter); // impact calculation
app.use("/health", healthRouter); // health checkup status
app.use("/api/github", githubRouter);
app.use("/api/alo", aloRouter);

// error handler
app.use(errorHandler);
