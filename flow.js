#!/usr/bin/env node

/**
 * Serial GitHub publishing flow for this repository.
 *
 * Run from the repository root:
 *   node flow.js
 *
 * It validates the configured origin, stages non-ignored files, creates a
 * commit when needed, and pushes the current project to origin/main.
 * Real .env files remain excluded by .gitignore; only .env.example is staged.
 */
const { execFileSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const repositoryRoot = __dirname;
const safeDirectory = repositoryRoot.replaceAll("\\", "/");
const expectedOrigin = "https://github.com/Rahul-2314/modulus.git";

function git(...args) {
	return execFileSync(
		"git",
		["-c", `safe.directory=${safeDirectory}`, ...args],
		{ cwd: repositoryRoot, encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
	).trim();
}

function main() {
	if (!existsSync(resolve(repositoryRoot, ".git"))) {
		throw new Error("Run this script from the repository root.");
	}

	const origin = git("remote", "get-url", "origin");
	if (origin !== expectedOrigin) {
		throw new Error(`Unexpected origin: ${origin}`);
	}

	git("branch", "-M", "main");
	git("add", "--all");

	try {
		git("diff", "--cached", "--quiet");
		console.log("No changes to commit.");
	} catch {
		const timestamp = new Date().toISOString().replace("T", " ").replace("Z", " UTC");
		git("commit", "-m", `chore: sync project (${timestamp})`);
	}

	git("push", "--set-upstream", "origin", "main");
	console.log("Published successfully to origin/main.");
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
