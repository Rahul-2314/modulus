import { Worker } from "bullmq";
import { prisma } from "@modulus/database";
import { notifyIncident } from "@modulus/notifications/customer";
import { instrumentWorkerMetrics } from "@modulus/queues/metrics";


const connection = { url: process.env.REDIS_URL! };

export const notifierWorker = new Worker(
	"notification",
	async (job) => {
		const { incidentId } = job.data as { incidentId: string };
		const incident = await prisma.incident.findUnique({
			where: { id: incidentId },
			include: { project: true },
		});
		if (!incident) return;

		await notifyIncident(incident.project, {
			incidentId: incident.id,
			title: incident.title,
			severity: incident.severity,
			projectName: incident.project.name,
			dashboardUrl: `${process.env.WEB_APP_URL}/projects/${incident.projectId}/incidents/${incident.id}`,
		});
	},
	{ connection },
);

// worker metrics
instrumentWorkerMetrics(notifierWorker, "notification");
