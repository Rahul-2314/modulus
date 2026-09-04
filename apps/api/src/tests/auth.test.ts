import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";

const password = "password123";
const createdEmails: string[] = [];
const email = (label: string) => {
	const value = `${label}-${randomUUID()}@example.com`;
	createdEmails.push(value);
	return value;
};

async function registerAndSignIn(
	agent: ReturnType<typeof request.agent>,
	userEmail: string,
) {
	await agent
		.post("/api/auth/sign-up/email")
		.send({ name: "Test User", email: userEmail, password })
		.expect(200);

	await prisma.user.update({
		where: { email: userEmail },
		data: { emailVerified: true },
	});

	await agent
		.post("/api/auth/sign-in/email")
		.send({ email: userEmail, password })
		.expect(200);
}

describe("auth flow", () => {
	afterAll(async () => {
		const users = await prisma.user.findMany({
			where: { email: { in: createdEmails } },
			include: { memberships: { select: { organizationId: true } } },
		});
		const organizationIds = users.flatMap((user) =>
			user.memberships.map((membership) => membership.organizationId),
		);

		await prisma.user.deleteMany({
			where: { id: { in: users.map((user) => user.id) } },
		});
		await prisma.organization.deleteMany({
			where: { id: { in: organizationIds } },
		});
		await prisma.$disconnect();
	});

	it("registers a new user and auto-creates an owner organization", async () => {
		const userEmail = email("register");
		const res = await request(app)
			.post("/api/auth/sign-up/email")
			.send({ name: "Test User", email: userEmail, password });

		expect(res.status).toBe(200);
		expect(res.body.user.email).toBe(userEmail);
		expect(res.body.token).toBeNull();
		expect(
			await prisma.membership.count({
				where: { user: { email: userEmail }, role: "owner" },
			}),
		).toBe(1);
	});

	it("rejects a duplicate email", async () => {
		const duplicateEmail = email("duplicate");
		await request(app)
			.post("/api/auth/sign-up/email")
			.send({ name: "Test User", email: duplicateEmail, password })
			.expect(200);

		const res = await request(app)
			.post("/api/auth/sign-up/email")
			.send({ name: "Test User", email: duplicateEmail, password });

		expect(res.status).toBe(200);
		expect(res.body.token).toBeNull();
	});

	it("rejects an incorrect password", async () => {
		const userEmail = email("wrong-password");
		await request(app)
			.post("/api/auth/sign-up/email")
			.send({ name: "Test User", email: userEmail, password })
			.expect(200);
		await prisma.user.update({
			where: { email: userEmail },
			data: { emailVerified: true },
		});

		const res = await request(app)
			.post("/api/auth/sign-in/email")
			.send({ email: userEmail, password: "incorrect-password" });

		expect(res.status).toBe(401);
	});

	it("registers, creates a project and key, then revokes the key", async () => {
		const agent = request.agent(app);
		await registerAndSignIn(agent, email("flow"));

		const me = await agent.get("/api/me").expect(200);
		const organizationId = me.body.data.organizations[0]?.id;
		expect(organizationId).toBeDefined();

		const project = await agent
			.post("/api/projects")
			.send({ organizationId, name: "Test Project" })
			.expect(201);

		const key = await agent
			.post(`/api/projects/${project.body.data.id}/keys`)
			.send({})
			.expect(201);
		expect(key.body.data.rawKey).toMatch(/^mod_live_/);

		await agent
			.delete(`/api/projects/${project.body.data.id}/keys/${key.body.data.id}`)
			.expect(200);
	});

	it("blocks cross-organization project access", async () => {
		const owner = request.agent(app);
		await registerAndSignIn(owner, email("owner"));
		const ownerMe = await owner.get("/api/me").expect(200);
		const project = await owner
			.post("/api/projects")
			.send({
				organizationId: ownerMe.body.data.organizations[0].id,
				name: "Private Project",
			})
			.expect(201);

		const otherUser = request.agent(app);
		await registerAndSignIn(otherUser, email("other-user"));

		await otherUser.get(`/api/projects/${project.body.data.id}`).expect(403);
	});
});
