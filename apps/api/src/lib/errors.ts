import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { ZodError } from "zod";

export class ApiError extends Error {
	constructor(
		public statusCode: number,
		public code: string,
		message: string,
		public details?: unknown,
	) {
		super(message);
	}
}

export function errorHandler(
	err: unknown,
	req: Request,
	res: Response,
	_next: NextFunction,
) {
	const requestId = randomUUID();

	if (err instanceof ZodError) {
		return res.status(400).json({
			success: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "Invalid request body",
				details: err.issues,
				requestId,
			},
		});
	}

	if (err instanceof ApiError) {
		return res.status(err.statusCode).json({
			success: false,
			error: {
				code: err.code,
				message: err.message,
				details: err.details,
				requestId,
			},
		});
	}

	if (
		typeof err === "object" &&
		err !== null &&
		(("type" in err && err.type === "entity.too.large") ||
			("status" in err && err.status === 413))
	) {
		return res.status(413).json({
			success: false,
			error: {
				code: "PAYLOAD_TOO_LARGE",
				message: "Request body is too large",
				requestId,
			},
		});
	}

	console.error(`[${requestId}]`, err);
	return res.status(500).json({
		success: false,
		error: {
			code: "INTERNAL_ERROR",
			message: "Something went wrong",
			requestId,
		},
	});
}
