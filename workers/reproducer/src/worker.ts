import "@modulus/config";
import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { runReproductionSandbox } from "@modulus/sandbox";
import { buildAuthenticatedCloneUrl } from "@modulus/github";
import { buildFixture } from "@modulus/fixtures";
import { mapResultToStatus } from "./status.js";
import { fixQueue } from "@modulus/queues";
import { resolveGithubToken } from "@modulus/github";
import { instrumentWorkerMetrics, recordDependencyFailure } from "@modulus/queues/metrics";

const connection = { url: process.env.REDIS_URL! };

export const reproducerWorker = new Worker(
	"reproduction",
	async (job) => {
		const { incidentId } = job.data as { incidentId: string };

		const incident = await prisma.incident.findUnique({
			where: { id: incidentId },
			include: {
				project: true,
				executions: {
					include: { execution: { include: { toolCalls: true } } },
					take: 1,
					orderBy: { createdAt: "desc" },
				},
			},
		});
		if (!incident || !incident.executions[0]) return;

		const { project } = incident;
		const execution = incident.executions[0].execution;

		if (!project.repositoryUrl) {
			await prisma.reproduction.create({
				data: {
					incidentId,
					status: "error",
					environment: "n/a",
					result: { reason: "no_repository_configured" },
				},
			});
			return;
		}

		const commitSha = execution.commitSha ?? project.defaultBranch ?? "main";
		const SANDBOX_IMAGE = process.env.MODULUS_SANDBOX_IMAGE ?? "node:24-slim";
		const reproduction = await prisma.reproduction.create({
			data: {
				incidentId,
				status: "running",
				environment: `${SANDBOX_IMAGE} @ ${commitSha}`,
			},
		});

		try {
			const token = await resolveGithubToken(project);
			const cloneUrl = buildAuthenticatedCloneUrl(
				project.repositoryUrl,
				token,
			);
			const fixture = buildFixture(execution, incident.title);

			const result = await runReproductionSandbox({
				cloneUrl,
				commitSha,
				fixture,
			});
			const status = mapResultToStatus(result.exitCode, result.timedOut);

			await prisma.reproduction.update({
				where: { id: reproduction.id },
				data: {
					status,
					result: { exitCode: result.exitCode, timedOut: result.timedOut },
					logs: result.logs,
				},
			});

			if (status === "reproduced") {
				await fixQueue.add("generate-fix", { incidentId });
			}
		} catch (err) {
			await recordDependencyFailure("docker-sandbox"); // generic "failed" listener
			await prisma.reproduction.update({
				where: { id: reproduction.id },
				data: { status: "error", result: { error: String(err) } },
			});
		}
	},
	{ connection, concurrency: 2 }, // Docker builds are by far the heaviest job type in the system so far
);

// worker metrics
instrumentWorkerMetrics(reproducerWorker, "reproducer");
