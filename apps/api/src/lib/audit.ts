import { prisma } from "./db";

import type { $Enums, Prisma } from "@modulus/database";

export interface AuditEntry {
	organizationId?: string;
	userId?: string;
	action: $Enums.AuditAction;
	resourceType: string;
	resourceId: string;
	metadata?: Prisma.InputJsonValue;
	ipAddress?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
	try {
		await prisma.auditLog.create({
			data: {
				action: entry.action,
				resourceType: entry.resourceType,
				resourceId: entry.resourceId,

				...(entry.organizationId !== undefined
					? { organizationId: entry.organizationId }
					: {}),

				...(entry.userId !== undefined ? { userId: entry.userId } : {}),

				...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),

				...(entry.ipAddress !== undefined
					? { ipAddress: entry.ipAddress }
					: {}),
			},
		});
	} catch (err) {
		console.error("audit log write failed", err);
	}
}
