import {
	buildImage,
	runIsolatedCommand,
	cleanupImage,
	SuiteResult,
} from "./internal.js";

const SANDBOX_IMAGE = process.env.MODULUS_SANDBOX_IMAGE ?? "node:24-slim";

export interface FixValidationOptions {
	cloneUrl: string;
	commitSha: string;
	diff: string;
	fixture: string;
	reproduceCommand?: string;
	testCommand?: string;
}

export interface FixValidationResult {
	reproduction: SuiteResult; // exit - original failure no longer reproduces
	regression: SuiteResult; // exit - existing test suite still passes
}

export async function runFixValidationSandbox(
	opts: FixValidationOptions,
): Promise<FixValidationResult> {
	let image: string | null = null;
	try {
		const patchEscaped = opts.diff.replace(/'/g, "'\\''");
		image = await buildImage(
			SANDBOX_IMAGE,
			`git clone --depth 50 "${opts.cloneUrl}" repo && cd repo && git checkout ${opts.commitSha} && ` +
				`npm ci && echo '${patchEscaped}' > /tmp/fix.diff && git apply /tmp/fix.diff`,
			"modulus-fix-sandbox",
		);

		const reproduction = await runIsolatedCommand(
			image,
			`echo '${opts.fixture.replace(/'/g, "'\\''")}' > /fixture.json && ${opts.reproduceCommand ?? "npm run modulus:reproduce"} -- --fixture /fixture.json`,
		);
		const regression = await runIsolatedCommand(
			image,
			opts.testCommand ?? "npm test",
		);

		return { reproduction, regression };
	} finally {
		if (image) await cleanupImage(image);
	}
}
