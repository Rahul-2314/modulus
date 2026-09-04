import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);
const WINDOW_SECONDS = 5 * 60;

// Resetting the TTL on every increment approximates (alerting thresholds)
async function bump(key: string) {
	const pipeline = redis.multi();
	pipeline.incr(key);
	pipeline.expire(key, WINDOW_SECONDS);
	await pipeline.exec();
}

type WorkerEvents = {
	on(
		event: "completed" | "failed",
		listener: (...args: unknown[]) => void,
	): unknown;
};

export function instrumentWorkerMetrics(
	worker: WorkerEvents,
	queueName: string,
) {
	worker.on("completed", () => bump(`metrics:${queueName}:completed:5m`));

	worker.on("failed", () => bump(`metrics:${queueName}:failed:5m`));
}

// For failures a worker catches and handles gracefully (rather than letting fail the BullMQ job)
export async function recordDependencyFailure(dependency: string) {
	await bump(`metrics:dependency:${dependency}:failed:5m`);
}
