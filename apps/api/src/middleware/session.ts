import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth/auth";
import { ApiError } from "../lib/errors";
import { prisma } from "../lib/db";

/* eslint-disable @typescript-eslint/no-namespace */
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
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		});
		if (!session)
			throw new ApiError(401, "UNAUTHENTICATED", "No active session");

		req.user = { id: session.user.id, email: session.user.email };
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
