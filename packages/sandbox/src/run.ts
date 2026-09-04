import { buildImage, runIsolatedCommand, cleanupImage } from "./internal.js";

export interface SandboxRunOptions {
	cloneUrl: string;
	commitSha: string;
	fixture: string;
	reproduceCommand?: string;
}

const SANDBOX_IMAGE = process.env.MODULUS_SANDBOX_IMAGE ?? "node:24-slim";


export async function runReproductionSandbox(opts: SandboxRunOptions) {
	let image: string | null = null;
	try {
		image = await buildImage(
			SANDBOX_IMAGE,
			`git clone --depth 50 "${opts.cloneUrl}" repo && cd repo && git checkout ${opts.commitSha} && npm ci`,
			"modulus-sandbox",
		);
		return await runIsolatedCommand(
			image,
			`echo '${opts.fixture.replace(/'/g, "'\\''")}' > /fixture.json && ${opts.reproduceCommand ?? "npm run modulus:reproduce"} -- --fixture /fixture.json`,
		);
	} finally {
		if (image) await cleanupImage(image);
	}
}
