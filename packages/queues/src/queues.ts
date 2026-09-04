import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL! };

export const ingestionQueue = new Queue("ingestion", { connection });
export const detectionQueue = new Queue("detection", { connection });
export const diagnosisQueue = new Queue("diagnosis", { connection });
export const reproductionQueue = new Queue("reproduction", { connection });
export const fixQueue = new Queue("fix", { connection });
export const retentionQueue = new Queue("retention", { connection });
export const notificationQueue = new Queue("notification", { connection });
export const platformMonitorQueue = new Queue("platform-monitor", { connection });
export const aloEvaluationQueue = new Queue("alo-evaluation", { connection });
export const aloSchedulerQueue = new Queue("alo-scheduler", { connection });

export async function scheduleAloEvaluationJob() {
	await aloSchedulerQueue.add(
		"fan-out-evaluations",
		{},
		{ repeat: { every: 15 * 60_000 }, jobId: "alo-fanout" },
	);
}

export async function schedulePlatformMonitorJob() {
  await platformMonitorQueue.add("check-platform-health", {}, { repeat: { every: 60_000 }, jobId: "platform-health-check" });
}

export async function scheduleRetentionJob() {
	// fixed jobId (repeated calls are idempotent, prevent double-schedule)
	await retentionQueue.upsertJobScheduler(
		"daily-retention-purge",
		{ pattern: "0 3 * * *" },
		{
			name: "purge-expired-data",
			data: {},
		},
	);
}