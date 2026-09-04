import { Writable } from "stream";
import { docker } from "./docker.js";
import { SANDBOX_LIMITS } from "./limits.js";

export interface SuiteResult {
	exitCode: number;
	logs: string;
	timedOut: boolean;
}

export async function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	container: { kill: () => Promise<void> },
): Promise<T> {
	let timer: NodeJS.Timeout;
	const race = Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			timer = setTimeout(async () => {
				await container.kill().catch(() => {});
				reject(new Error("Sandbox execution timed out"));
			}, ms);
		}),
	]);
	try {
		return await race;
	} finally {
		clearTimeout(timer!);
	}
}

export async function buildImage(
	baseImage: string,
	buildCmd: string,
	tagPrefix: string,
): Promise<string> {
	const name = `${tagPrefix}-build-${Date.now()}`;
	const builder = await docker.createContainer({
		name,
		Image: baseImage,
		Cmd: ["bash", "-c", buildCmd],
		HostConfig: {
			Memory: SANDBOX_LIMITS.memoryBytes,
			NanoCpus: SANDBOX_LIMITS.nanoCpus,
			PidsLimit: SANDBOX_LIMITS.pidsLimit,
			AutoRemove: false,
		},
	});

	await builder.start();
	await withTimeout(builder.wait(), SANDBOX_LIMITS.timeoutMs, builder);

	const tag = `${Date.now()}`;
	await builder.commit({ repo: tagPrefix, tag });
	await builder.remove({ force: true });
	return `${tagPrefix}:${tag}`;
}

export async function runIsolatedCommand(
	image: string,
	cmd: string,
): Promise<SuiteResult> {
	const name = `sandbox-run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
	const container = await docker.createContainer({
		name,
		Image: image,
		WorkingDir: "/repo",
		Cmd: ["bash", "-c", cmd],
		HostConfig: {
			Memory: SANDBOX_LIMITS.memoryBytes,
			NanoCpus: SANDBOX_LIMITS.nanoCpus,
			PidsLimit: SANDBOX_LIMITS.pidsLimit,
			NetworkMode: "none",
			AutoRemove: false,
		},
	});

	let logs = "";
	const sink = new Writable({
		write(chunk, _e, cb) {
			logs += chunk.toString();
			cb();
		},
	});
	await container.start();
	const stream = await container.logs({
		follow: true,
		stdout: true,
		stderr: true,
	});
	container.modem.demuxStream(stream, sink, sink);

	let timedOut = false;
	const result = await withTimeout(
		container.wait(),
		SANDBOX_LIMITS.timeoutMs,
		container,
	).catch(() => {
		timedOut = true;
		return { StatusCode: -1 };
	});
	await container.remove({ force: true }).catch(() => {});
	return { exitCode: result.StatusCode, logs: logs.slice(0, 20_000), timedOut };
}

export async function cleanupImage(tag: string) {
	await docker
		.getImage(tag)
		.remove({ force: true })
		.catch(() => {});
}
