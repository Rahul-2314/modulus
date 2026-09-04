import { z } from "zod";

export const paginationQuerySchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});

// cursor based pagination
export interface PaginatedResult<T> {
	items: T[];
	nextCursor: string | null;
}

export function buildPaginatedResult<T extends { id: string }>(
	rows: T[],
	limit: number,
): PaginatedResult<T> {
	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;    // next page available
	return { items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null };
}