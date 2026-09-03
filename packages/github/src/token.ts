import { decrypt } from "@modulus/crypto";
import type { Project } from "@modulus/database";
import { getInstallationToken } from "./app.js";

export async function resolveGithubToken(
	project: Pick<Project, "githubInstallationId" | "githubTokenEncrypted">,
): Promise<string> {
	
	if (project.githubInstallationId)
		return getInstallationToken(project.githubInstallationId);
	if (project.githubTokenEncrypted)
		return decrypt(project.githubTokenEncrypted);

	throw new Error(
		"No GitHub credentials available: install the Modulus GitHub App or set a project token",
	);
}
