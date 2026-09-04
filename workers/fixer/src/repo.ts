import { simpleGit } from "simple-git";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export async function withClonedRepo<T>(
	cloneUrl: string,
	commitSha: string,
	fn: (repoDir: string) => Promise<T>,
): Promise<T> {
	const dir = await mkdtemp(path.join(tmpdir(), "modulus-fix-"));
	try {
		const git = simpleGit();
		await git.clone(cloneUrl, dir, ["--depth", "50"]);
		await git.cwd(dir).checkout(commitSha);
		return await fn(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}
