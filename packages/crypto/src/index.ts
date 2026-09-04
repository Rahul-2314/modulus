import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

// create buffer
function getKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key) throw new Error("ENCRYPTION_KEY is not set");

	const buf = Buffer.from(key, "base64");
	if (buf.length !== 32)
		throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
	return buf;
}

// encryption logic
export function encrypt(plaintext: string): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf-8"),
		cipher.final(),
	]);
	return [
		iv.toString("base64"),
		cipher.getAuthTag().toString("base64"),
		ciphertext.toString("base64"),
	].join(".");
}

// decryption logic
export function decrypt(envelope: string): string {
	const [ivB64, tagB64, ciphertextB64] = envelope.split(".");
	if (!ivB64 || !tagB64 || !ciphertextB64)
		throw new Error("Malformed encrypted value");

	const decipher = createDecipheriv(
		ALGORITHM,
		getKey(),
		Buffer.from(ivB64, "base64"),
	);
	decipher.setAuthTag(Buffer.from(tagB64, "base64"));
	return Buffer.concat([
		decipher.update(Buffer.from(ciphertextB64, "base64")),
		decipher.final(),
	]).toString("utf-8");
}
