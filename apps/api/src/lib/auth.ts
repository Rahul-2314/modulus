import bcrypt from "bcrypt";
import jwt from  "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
if(!JWT_SECRET) throw new Error("JWT_SECRET is not set");

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}


export interface SessionPayload {
    userId: string;
}

export function signSession(payload: SessionPayload): string {
    return jwt.sign(payload, JWT_SECRET, {expiresIn: "7d"});
}

export function verifySession(token: string): SessionPayload {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
}

export const SESSION_COOKIE = "modulus_session";

export const cookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax" as const,
	maxAge: 7 * 24 * 60 * 60 * 1000,
};

