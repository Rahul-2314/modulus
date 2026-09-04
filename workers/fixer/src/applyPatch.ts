import { simpleGit } from "simple-git";
import { writeFile } from "fs/promises";
import path from "path";

export async function applyAndDiff(
	repoDir: string,
	filePath: string,
	newContent: string,
): Promise<string> {
	await writeFile(path.join(repoDir, filePath), newContent, "utf-8");
	return simpleGit(repoDir).diff([filePath]); // always syntactically valid — real git output
}
