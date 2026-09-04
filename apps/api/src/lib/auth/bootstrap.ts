import { prisma } from "../db.js";

export async function personalOrg(userId: string, email: string) {
	const existing = await prisma.membership.findFirst({ where: { userId } });
	if (existing) return; // idempotent 

	await prisma.$transaction(async (tx) => {
		const org = await tx.organization.create({
			data: { name: `${email}'s Organization` },
		});
		await tx.membership.create({
			data: { userId, organizationId: org.id, role: "owner" },
		});
	});
}
