const HIGH_RISK_PATH_PATTERN =
	/(auth|payment|billing|migrations?|\.env|secrets?|security)/i;

export function assessRisk(
	defaultRisk: "low" | "medium" | "high",
	filePath: string,
): "low" | "medium" | "high" {
	if (HIGH_RISK_PATH_PATTERN.test(filePath)) return "high";
	return defaultRisk;
}
