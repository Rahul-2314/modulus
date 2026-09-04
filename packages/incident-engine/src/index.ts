import { prisma } from "@modulus/database";
import { diagnosisQueue, notificationQueue } from "@modulus/queues";

const AGGREGATION_WINDOW_MS = 30 * 60 * 1000;
const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 } as const;

export interface Finding {
	projectId: string;
	ruleId: string;
	title: string;
	severity: keyof typeof SEVERITY_RANK;
	executionId?: string; // trend-based
}

export async function linkFindingToIncident(
	finding: Finding,
): Promise<{ incidentId: string; isNew: boolean }> {
	const cutoff = new Date(Date.now() - AGGREGATION_WINDOW_MS);

	const { incidentId, isNew } = await prisma.$transaction(async (tx) => {
		const existing = await tx.incident.findFirst({
			where: {
				projectId: finding.projectId,
				ruleId: finding.ruleId,
				status: "open",
				lastSeen: { gte: cutoff },
			},
			orderBy: { lastSeen: "desc" },
		});

		const incident = existing
			? await tx.incident.update({
					where: { id: existing.id },
					data: { lastSeen: new Date(), occurrenceCount: { increment: 1 } },
				})
			: await tx.incident.create({
					data: {
						projectId: finding.projectId,
						ruleId: finding.ruleId,
						title: finding.title,
						severity: finding.severity,
						firstSeen: new Date(),
						lastSeen: new Date(),
					},
				});

		if (finding.executionId) {
			await tx.incidentExecution.upsert({
				where: {
					incidentId_executionId: {
						incidentId: incident.id,
						executionId: finding.executionId,
					},
				},
				create: { incidentId: incident.id, executionId: finding.executionId },
				update: {},
			});
		}
		return { incidentId: incident.id, isNew: !existing };
	});

	if (isNew) {
		if (finding.executionId)
			await diagnosisQueue.add("diagnose-incident", { incidentId });
		await maybeNotify(finding.projectId, incidentId, finding.severity);
	}
	return { incidentId, isNew };
}

async function maybeNotify(
	projectId: string,
	incidentId: string,
	severity: keyof typeof SEVERITY_RANK,
) {
	const project = await prisma.project.findUnique({ where: { id: projectId } });
	if (!project) return;
	const threshold = project.alertMinSeverity ?? "high";
	if (SEVERITY_RANK[severity] < SEVERITY_RANK[threshold]) return;
	await notificationQueue.add("notify-incident", { incidentId });
}