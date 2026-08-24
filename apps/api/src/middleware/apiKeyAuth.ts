import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db";
import { hashApiKey } from "../lib/apiKeys";
import { ApiError } from "../lib/errors";

declare global {
	namespace Express {
		interface Request {
			project?: { id: string };
		}
	}
}

export async function requireApiKey(
	req: Request,
	_res: Response,
	next: NextFunction,
) {
	try {
		const header = req.header("authorization");
		const rawKey = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
		if (!rawKey)
			throw new ApiError(
				401,
				"MISSING_API_KEY",
				"Authorization: Bearer <key> is required",
			);

		const key = await prisma.apiKey.findFirst({
			where: { keyHash: hashApiKey(rawKey), revokedAt: null },
		});
		if (!key)
			throw new ApiError(
				401,
				"INVALID_API_KEY",
				"API key is invalid or revoked",
			);

		req.project = { id: key.projectId };
		next();
	} catch (err) {
		next(err);
	}
}
