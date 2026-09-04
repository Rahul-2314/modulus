export function buildAuthenticatedCloneUrl(
	repositoryUrl: string,
	token: string,
): string {
	const url = new URL(repositoryUrl);
	url.username = "x-access-token";
	url.password = token;
	return url.toString();
}
