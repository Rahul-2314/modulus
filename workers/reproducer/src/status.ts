export function mapResultToStatus(
	exitCode: number,
	timedOut: boolean,
): "reproduced" | "not_reproduced" | "error" {
	if (timedOut) return "error";
	return exitCode !== 0 ? "reproduced" : "not_reproduced";
}
