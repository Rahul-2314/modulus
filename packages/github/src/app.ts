import { createAppAuth } from "@octokit/auth-app";

const appAuth = createAppAuth({
	appId: process.env.GITHUB_APP_ID!,
	privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n"), // can't hold real newlines
	clientId: process.env.GITHUB_APP_CLIENT_ID,
	clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
});

// Installation tokens last 1h (cache in-memory) 
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

export async function getInstallationToken(
	installationId: number,
): Promise<string> {
	const cached = tokenCache.get(installationId);
	if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

	const { token, expiresAt } = await appAuth({
		type: "installation",
		installationId,
	});
	tokenCache.set(installationId, {
		token,
		expiresAt: new Date(expiresAt).getTime(),
	});
	return token;
}

