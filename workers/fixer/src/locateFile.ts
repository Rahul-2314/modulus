import { promises as fs } from "fs";
import path from "path";

// Best-effort: search the repo for a file whose basename matches the
// diagnosis's affected component. A proper implementation would use stack/
// call-site info once framework adapters start emitting it — not yet available.
export async function locateFile(
	repoDir: string,
	affectedComponent: string,
): Promise<string | null> {
	const target = path.basename(affectedComponent).toLowerCase();
	const matches: string[] = [];

	async function walk(dir: string) {
		for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
			if (entry.name === "node_modules" || entry.name === ".git") continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.toLowerCase().includes(target)) matches.push(full);
		}
	}

	await walk(repoDir);
	return matches[0] ? path.relative(repoDir, matches[0]) : null;
}
