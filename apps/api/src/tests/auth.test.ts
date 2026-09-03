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
		const res = await request(app)
			.post("/api/auth/register")
			.send({ email: email("register"), password });

		expect(res.status).toBe(201);
		expect(res.body.success).toBe(true);
	});

	it("rejects a duplicate email", async () => {
		const duplicateEmail = email("duplicate");
		await request(app)
			.post("/api/auth/register")
			.send({ email: duplicateEmail, password })
			.expect(201);

		const res = await request(app)
			.post("/api/auth/register")
			.send({ email: duplicateEmail, password });

		expect(res.status).toBe(409);
	});

	it("rejects an incorrect password", async () => {
		const userEmail = email("wrong-password");
		await request(app)
			.post("/api/auth/register")
			.send({ email: userEmail, password })
			.expect(201);

		const res = await request(app)
			.post("/api/auth/login")
			.send({ email: userEmail, password: "incorrect-password" });

		expect(res.status).toBe(401);
	});

	it("registers, creates a project and key, then revokes the key", async () => {
		const agent = request.agent(app);
		await agent
			.post("/api/auth/register")
			.send({ email: email("flow"), password })
			.expect(201);

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
		await owner
			.post("/api/auth/register")
			.send({ email: email("owner"), password })
			.expect(201);
		const ownerMe = await owner.get("/api/me").expect(200);
		const project = await owner
			.post("/api/projects")
			.send({
				organizationId: ownerMe.body.data.organizations[0].id,
				name: "Private Project",
			})
			.expect(201);

		const otherUser = request.agent(app);
		await otherUser
			.post("/api/auth/register")
			.send({ email: email("other-user"), password })
			.expect(201);

		await otherUser.get(`/api/projects/${project.body.data.id}`).expect(403);
	});
});
