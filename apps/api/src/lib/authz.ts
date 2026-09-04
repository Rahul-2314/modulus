import { prisma } from "./db";
import { ApiError } from "./errors";
import type { Membership, Project } from "@modulus/database";

type Role = "member" | "admin" | "owner";
const ROLE_RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

export async function assertOrgAccess(
	userId: string,
	organizationId: string,
	minRole?: Role,
): Promise<Membership> {
	const membership = await prisma.membership.findUnique({
		where: { userId_organizationId: { userId, organizationId } },
	});

	if (!membership)
		throw new ApiError(403, "FORBIDDEN", "No access to this organization");
	if (minRole && ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
		throw new ApiError(403, "FORBIDDEN", `Requires ${minRole} role or higher`);
	}
	return membership;
}

export async function assertProjectAccess(
	userId: string,
	projectId: string,
	minRole?: Role,
): Promise<Project> {
	const project = await prisma.project.findUnique({ where: { id: projectId } });
	if (!project) throw new ApiError(404, "NOT_FOUND", "Project not found");

	await assertOrgAccess(userId, project.organizationId, minRole);
	return project;
}
