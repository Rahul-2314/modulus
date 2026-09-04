import { Worker, Queue } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@modulus/database";
import { sendPlatformNotification } from "@modulus/notifications/platform";
import { QUEUE_DEPTH_WARNING, QUEUE_DEPTH_CRITICAL, FAILURE_RATE_WARNING, FAILURE_RATE_CRITICAL } from "./thresholds.js";

const connection = { url: process.env.REDIS_URL! };
const redis = new Redis(process.env.REDIS_URL!);

const MONITORED_QUEUE_NAMES = [
	"ingestion",
	"detection",
	"diagnosis",
	"reproduction",
	"fix",
	"notification",
	"retention",
];

// intance creating once and reused
const monitoredQueues = MONITORED_QUEUE_NAMES.map(
	(name) => new Queue(name, { connection }),
);

const ALERT_COOLDOWN_SECONDS = 15 * 60;

export const platformMonitorWorker = new Worker(
  "platform-monitor",
  async () => {
    for (const queue of monitoredQueues) {
      const counts = await queue.getJobCounts("waiting", "active", "failed", "delayed");
      const depth = counts.waiting + counts.active + counts.delayed;

      const [failedInWindow, completedInWindow] = await Promise.all([
        redis.get(`metrics:${queue.name}:failed:5m`).then((v) => Number(v ?? 0)),
        redis.get(`metrics:${queue.name}:completed:5m`).then((v) => Number(v ?? 0)),
      ]);
      const total = failedInWindow + completedInWindow;
      const failureRate = total > 0 ? failedInWindow / total : 0;

      await checkAndAlert(`queue:${queue.name}`, "depth", depth, QUEUE_DEPTH_WARNING, QUEUE_DEPTH_CRITICAL, `${queue.name} queue depth is ${depth}`);
      await checkAndAlert(`queue:${queue.name}`, "failure_rate", failureRate, FAILURE_RATE_WARNING, FAILURE_RATE_CRITICAL, `${queue.name} queue failure rate is ${(failureRate * 100).toFixed(1)}% over the last 5 minutes`);
    }

    // labeled dependency counters (Groq, Docker sandbox).
    for (const dep of ["groq", "docker-sandbox"]) {
      const failed = Number((await redis.get(`metrics:dependency:${dep}:failed:5m`)) ?? 0);
      if (failed >= 5) await checkAndAlert(`dependency:${dep}`, "failures", failed, 5, 20, `${dep} has failed ${failed} times in the last 5 minutes`);
    }
  },
  { connection }
);

async function checkAndAlert(source: string, metric: string, value: number, warnThreshold: number, criticalThreshold: number, message: string) {
  if (value < warnThreshold) return;
  const severity = value >= criticalThreshold ? "critical" : "warning";

  await prisma.platformAlert.create({ data: { source, message, severity, metadata: { metric, value } } });

  // every threshold breach is recorded above
  const acquired = await redis.set(`alert-cooldown:${source}:${metric}`, "1", "EX", ALERT_COOLDOWN_SECONDS, "NX");
  if (acquired) await sendPlatformNotification({ source, message, severity });
}