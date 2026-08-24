const SENSITIVE_KEY_PATTERN =
	/(api[_-]?key|password|secret|token|authorization)/i;

export function redact(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redact);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [
				k,
				SENSITIVE_KEY_PATTERN.test(k) ? "[REDACTED]" : redact(v),
			]),
		);
	}
	return value;
}
