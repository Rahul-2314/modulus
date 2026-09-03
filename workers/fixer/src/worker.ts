import "@modulus/config";
import { Worker } from "bullmq";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@modulus/database";
import { runFixValidationSandbox } from "@modulus/sandbox";
import { buildAuthenticatedCloneUrl, openPullRequest } from "@modulus/github";
import { buildFixture } from "@modulus/fixtures";
import { withClonedRepo } from "./repo.js";
import { locateFile } from "./locateFile.js";
import { applyAndDiff } from "./applyPatch.js";
import { selectStrategy } from "./strategy.js";
import { assessRisk } from "./risk.js";
import { generatePatch } from "./patch.js";
import { resolveGithubToken } from "@modulus/github";
import { instrumentWorkerMetrics } from "@modulus/queues/metrics";
import { resolveCostTier } from "@modulus/cost-tier";

const connection = { url: process.env.REDIS_URL! };

export const fixerWorker = new Worker(
	"fix",
	async (job) => {
		const { incidentId } = job.data as { incidentId: string };

		const incident = await prisma.incident.findUnique({
			where: { id: incidentId },
			include: {
				project: true,
				diagnosis: true,
				executions: {
					include: { execution: { include: { toolCalls: true } } },
					take: 1,
					orderBy: { createdAt: "desc" },
				},
				reproductions: { orderBy: { createdAt: "desc" }, take: 1 },
			},
		});

		// Gate: only fix confirmed, diagnosed failures — the same correctness/
		// cost gating pattern used for diagnosis (Day 5) and reproduction (Day 6).
		if (
			!incident?.diagnosis ||
			incident.reproductions[0]?.status !== "reproduced"
		)
			return;
		if (!incident.project.repositoryUrl || !incident.executions[0]) return;

		const { diagnosis, project } = incident;
		const execution = incident.executions[0].execution;
		const tier = await resolveCostTier(execution.agentId);
		const strategy = selectStrategy(incident.ruleId);
		const commitSha = execution.commitSha ?? project.defaultBranch ?? "main";
		const baseBranch = project.defaultBranch ?? "main";
		const token = await resolveGithubToken(project);
		const cloneUrl = buildAuthenticatedCloneUrl(
			project.repositoryUrl!,
			token,
		);

		await withClonedRepo(cloneUrl, commitSha, async (repoDir) => {
			const filePath = await locateFile(repoDir, diagnosis.affectedComponent);
			if (!filePath) {
				await prisma.fix.upsert({
					where: { incidentId },
					create: {
						incidentId,
						strategy: strategy.id,
						diff: "",
						filePath: "unknown",
						riskLevel: "high",
						status: "needs_review",
					},
					update: { status: "needs_review" },
				});
				return;
			}

			const fileContent = await readFile(path.join(repoDir, filePath), "utf-8");
			const { data: patch } = await generatePatch(
				diagnosis,
				incident,
				strategy,
				filePath,
				fileContent,
				tier,
			);
			const diff = await applyAndDiff(
				repoDir,
				patch.filePath,
				patch.newContent,
			);
			const riskLevel = assessRisk(strategy.defaultRisk, patch.filePath);

			const fix = await prisma.fix.upsert({
				where: { incidentId },
				create: {
					incidentId,
					strategy: strategy.id,
					diff,
					filePath: patch.filePath,
					riskLevel,
					status: "validated",
				},
				update: {
					strategy: strategy.id,
					diff,
					filePath: patch.filePath,
					riskLevel,
					status: "validated",
				},
			});

			// High risk stops here — before the expensive sandbox run — per §9:
			// "no autonomous action; human required."
			if (riskLevel === "high") {
				await prisma.fix.update({
					where: { id: fix.id },
					data: { status: "needs_review" },
				});
				return;
			}

			const fixture = buildFixture(execution, incident.title);
			const validation = await runFixValidationSandbox({
				cloneUrl,
				commitSha,
				diff,
				fixture,
			});

			await prisma.testRun.createMany({
				data: [
					{
						fixId: fix.id,
						suite: "reproduction",
						passed: validation.reproduction.exitCode === 0 ? 1 : 0,
						failed: validation.reproduction.exitCode === 0 ? 0 : 1,
						durationMs: 0,
						report: { logs: validation.reproduction.logs },
					},
					{
						fixId: fix.id,
						suite: "regression",
						passed: validation.regression.exitCode === 0 ? 1 : 0,
						failed: validation.regression.exitCode === 0 ? 0 : 1,
						durationMs: 0,
						report: { logs: validation.regression.logs },
					},
				],
			});

			const passed =
				validation.reproduction.exitCode === 0 &&
				validation.regression.exitCode === 0;
			await prisma.fix.update({
				where: { id: fix.id },
				data: { status: passed ? "tests_passed" : "tests_failed" },
			});
			if (!passed) return;

			const pr = await openPullRequest(token, {
				repositoryUrl: project.repositoryUrl!,
				baseBranch,
				filePath: patch.filePath,
				newContent: patch.newContent,
				fixId: fix.id,
				incidentTitle: incident.title,
				explanation: patch.explanation,
				riskLevel,
				diagnosis: {
					rootCause: diagnosis.rootCause,
					confidence: diagnosis.confidence,
				},
				testResults: {
					reproductionPassed: validation.reproduction.exitCode === 0,
					regressionPassed: validation.regression.exitCode === 0,
				},
			});

			await prisma.pullRequest.create({
				data: {
					fixId: fix.id,
					repository: project.repositoryUrl!,
					branch: pr.branch,
					prNumber: pr.number,
					url: pr.url,
					status: "open",
				},
			});
			await prisma.fix.update({
				where: { id: fix.id },
				data: { status: "pr_created" },
			});
		});
	},
	{ connection, concurrency: 2 },
);

// worker metrics
instrumentWorkerMetrics(fixerWorker, "fixer");
