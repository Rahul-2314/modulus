import type { Request, Response, NextFunction } from "express";
import { verifySession, SESSION_COOKIE } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { prisma } from "../lib/db";

declare global {
	namespace Express {
		interface Request {
			user?: { id: string; email: string };
		}
	}
}

export async function requireSession(
	req: Request,
	_res: Response,
	next: NextFunction,
) {
	try {
		const token = req.cookies?.[SESSION_COOKIE];
		if (!token) throw new ApiError(401, "UNAUTHENTICATED", "No active session");

		const payload = verifySession(token);
		const user = await prisma.user.findUnique({
			where: { id: payload.userId },
		});
		if (!user)
			throw new ApiError(
				401,
				"UNAUTHENTICATED",
				"Session user no longer exists",
			);

		req.user = { id: user.id, email: user.email };
		next();
	} catch (err) {
		if (err instanceof ApiError) return next(err);
		next(new ApiError(401, "UNAUTHENTICATED", "Invalid or expired session"));
	}
}

type Role = "member" | "admin" | "owner";

export function requireOrgAccess(minRole?: "owner" | "admin" | "member") {
	// const rank = { member: 0, admin: 1, owner: 2 };
	const rank: Record<Role, number> = {
		member: 0,
		admin: 1,
		owner: 2,
	};

	return async (req: Request, _res: Response, next: NextFunction) => {
		try {
			const organizationId = req.params.orgId ?? req.body.organizationId;
			if (!organizationId)
				throw new ApiError(400, "BAD_REQUEST", "organizationId is required");

			const membership = await prisma.membership.findUnique({
				where: {
					userId_organizationId: { userId: req.user!.id, organizationId },
				},
			});

			if (!membership)
				throw new ApiError(403, "FORBIDDEN", "No access to this organization");
			if (minRole && rank[membership.role as Role] < rank[minRole]) {
				throw new ApiError(
					403,
					"FORBIDDEN",
					`Requires ${minRole} role or higher`,
				);
			}

			next();
		} catch (err) {
			next(
				err instanceof ApiError
					? err
					: new ApiError(500, "INTERNAL_ERROR", "Access check failed"),
			);
		}
	};
}
