import { randomBytes, createHash } from "crypto";

const PREFIX = "mod_live_";

export function generateApiKey() {
	const raw = randomBytes(32).toString("hex");
	const rawKey = `${PREFIX}${raw}`;
	const hash = createHash("sha256").update(rawKey).digest("hex");
	return { rawKey, prefix: PREFIX, hash };
}

export function hashApiKey(rawKey: string): string {
	return createHash("sha256").update(rawKey).digest("hex");
}
