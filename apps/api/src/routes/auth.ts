import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import {
	hashPassword,
	verifyPassword,
	signSession,
	cookieOptions,
	SESSION_COOKIE,
} from "../lib/auth";
import { ApiError } from "../lib/errors";
import { requireSession } from "../middleware/session";

export const authRouter = Router();

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

authRouter.post("/register", async (req, res, next) => {
	try {
		const { email, password } = registerSchema.parse(req.body);

		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing)
			throw new ApiError(
				409,
				"EMAIL_TAKEN",
				"An account with this email already exists",
			);

		const passwordHash = await hashPassword(password);

		// Register + auto-create personal org + owner membership, atomically.
		const { user } = await prisma.$transaction(async (tx) => {
			const user = await tx.user.create({ data: { email, passwordHash } });
			const org = await tx.organization.create({
				data: { name: `${email}'s Organization` },
			});
			await tx.membership.create({
				data: { userId: user.id, organizationId: org.id, role: "owner" },
			});
			return { user, org };
		});

		const token = signSession({ userId: user.id });
		res.cookie(SESSION_COOKIE, token, cookieOptions);
		res
			.status(201)
			.json({ success: true, data: { id: user.id, email: user.email } });
	} catch (err) {
		next(err);
	}
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string(),
});

authRouter.post("/login", async (req, res, next) => {
	try {
		const { email, password } = loginSchema.parse(req.body);

		const user = await prisma.user.findUnique({ where: { email } });
		if (!user)
			throw new ApiError(
				401,
				"INVALID_CREDENTIALS",
				"Invalid email or password",
			);

		const valid = await verifyPassword(password, user.passwordHash);
		if (!valid)
			throw new ApiError(
				401,
				"INVALID_CREDENTIALS",
				"Invalid email or password",
			);

		const token = signSession({ userId: user.id });
		res.cookie(SESSION_COOKIE, token, cookieOptions);
		res.json({ success: true, data: { id: user.id, email: user.email } });
	} catch (err) {
		next(err);
	}
});

authRouter.post("/logout", requireSession, (req, res) => {
	res.clearCookie(SESSION_COOKIE);
	res.json({ success: true, data: null });
});
