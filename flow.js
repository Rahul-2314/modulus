#!/usr/bin/env node

/**
 * Serial GitHub publishing flow.
 *
 * Run:
 *   node flow.js
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repositoryRoot = __dirname;

const safeDirectory = repositoryRoot.replaceAll("\\", "/");

const expectedOrigin = "https://github.com/Rahul-2314/modulus.git";

function git(...args) {
	return execFileSync(
		"git",
		["-c", `safe.directory=${safeDirectory}`, ...args],
		{
			cwd: repositoryRoot,
			encoding: "utf8",
			stdio: ["inherit", "pipe", "inherit"],
		},
	).trim();
}

function main() {
	if (!existsSync(resolve(repositoryRoot, ".git"))) {
		throw new Error(
			"flow.js must be located and run from the repository root.",
		);
	}

	const origin = git("remote", "get-url", "origin");

	if (origin !== expectedOrigin) {
		throw new Error(
			`Unexpected origin.\nExpected: ${expectedOrigin}\nActual: ${origin}`,
		);
	}

	console.log(`Repository: ${repositoryRoot}`);
	console.log(`Origin: ${origin}`);

	const currentBranch = git("branch", "--show-current");

	if (!currentBranch) {
		throw new Error("You are in a detached HEAD state.");
	}

	console.log(`Branch: ${currentBranch}`);

	const webEntry = git("ls-files", "--stage", "apps/web");

	if (webEntry.startsWith("160000 ")) {
		console.log("Removing embedded Git repository reference from apps/web...");

		git("rm", "--cached", "--ignore-unmatch", "apps/web");

		git("add", "apps/web");
	}

	console.log("Staging changes...");

	git("add", "--all");

	try {
		git("diff", "--cached", "--quiet");

		console.log("No changes to commit.");
	} catch {
		const timestamp = new Date()
			.toISOString()
			.replace("T", " ")
			.replace("Z", " UTC");

		const message = `chore: sync project (${timestamp})`;

		console.log("Creating commit...");

		git("commit", "-m", message);
	}

	console.log(`Pushing ${currentBranch}...`);

	git("push", "--set-upstream", "origin", currentBranch);

	console.log(`Successfully published ${currentBranch} to GitHub.`);
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);

	process.exitCode = 1;
}
