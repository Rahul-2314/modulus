import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../app.js";
import { prisma } from "../lib/db.js";

const {
	diagnosisAdd,
	ingestionAdd,
	reproductionAdd,
	fixAdd,
	scheduleRetentionJob,
	schedulePlatformMonitorJob,
	scheduleAloEvaluationJob,
} = vi.hoisted(() => ({
	diagnosisAdd: vi.fn().mockResolvedValue({ id: "diagnosis-job" }),
	ingestionAdd: vi.fn().mockResolvedValue({ id: "ingestion-job" }),
	reproductionAdd: vi.fn().mockResolvedValue({ id: "reproduction-job" }),
	fixAdd: vi.fn().mockResolvedValue({ id: "fix-job" }),
	scheduleRetentionJob: vi.fn().mockResolvedValue(undefined),
	schedulePlatformMonitorJob: vi.fn().mockResolvedValue(undefined),
	scheduleAloEvaluationJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@modulus/queues", () => ({
	diagnosisQueue: {
		add: diagnosisAdd,
	},
	ingestionQueue: {
		add: ingestionAdd,
	},
	reproductionQueue: {
		add: reproductionAdd,
	},
	fixQueue: {
		add: fixAdd,
	},
	scheduleRetentionJob,
	schedulePlatformMonitorJob,
	scheduleAloEvaluationJob,
}));

const password = "password123";
const createdEmails: string[] = [];
const createdProjectIds: string[] = [];

function uniqueEmail(): string {
	const value = `routes-${randomUUID()}@example.com`;
	createdEmails.push(value);
	return value;
}

async function createAuthenticatedProject() {
	const agent = request.agent(app);
	const userEmail = uniqueEmail();

	await agent
		.post("/api/auth/sign-up/email")
		.send({ name: "Route Test User", email: userEmail, password })
		.expect(200);

	await prisma.user.update({
		where: { email: userEmail },
		data: { emailVerified: true },
	});

	await agent
		.post("/api/auth/sign-in/email")
		.send({ email: userEmail, password })
		.expect(200);

	const me = await agent.get("/api/me").expect(200);

	const organizationId = me.body.data.organizations[0]?.id;
	expect(organizationId).toBeDefined();

	const project = await agent
		.post("/api/projects")
		.send({
			organizationId,
			name: "Route Test Project",
		})
		.expect(201);

	createdProjectIds.push(project.body.data.id);

	return {
		agent,
		projectId: project.body.data.id,
	};
}

beforeEach(() => {
	diagnosisAdd.mockClear();
	ingestionAdd.mockClear();
	reproductionAdd.mockClear();
	fixAdd.mockClear();
});

describe("API route smoke checks", () => {
	it("responds to the health endpoint", async () => {
		const response = await request(app).get("/");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			success: true,
			message: "API is running",
		});
	});

	it.each([
		["GET", "/api/me"],
		["POST", "/api/projects"],
		["GET", "/api/projects"],
		["GET", "/api/projects/00000000-0000-0000-0000-000000000000"],
		["POST", "/api/projects/00000000-0000-0000-0000-000000000000/keys"],
		[
			"DELETE",
			"/api/projects/00000000-0000-0000-0000-000000000000/keys/00000000-0000-0000-0000-000000000000",
		],
		["GET", "/api/incidents?projectId=00000000-0000-0000-0000-000000000000"],
		["GET", "/api/incidents/00000000-0000-0000-0000-000000000000"],
		["PATCH", "/api/incidents/00000000-0000-0000-0000-000000000000"],
		["POST", "/api/incidents/00000000-0000-0000-0000-000000000000/diagnose"],
		["POST", "/api/incidents/00000000-0000-0000-0000-000000000000/reproduce"],
		["POST", "/api/incidents/00000000-0000-0000-0000-000000000000/fix"],
		["POST", "/api/ingest/traces"],
	] as const)("requires authentication: %s %s", async (method, path) => {
		const response = await request(app)[method.toLowerCase() as "get"](path);

		expect(response.status).toBe(401);
		expect(response.body.success).toBe(false);
	});

	it("queues scheduled background jobs when the API starts", async () => {
		expect(scheduleRetentionJob).toHaveBeenCalled();
		expect(schedulePlatformMonitorJob).toHaveBeenCalled();
		expect(scheduleAloEvaluationJob).toHaveBeenCalled();
	});

	it("lists, reads, updates, and queues diagnosis for an incident", async () => {
		const { agent, projectId } = await createAuthenticatedProject();

		const incident = await prisma.incident.create({
			data: {
				projectId,
				ruleId: "schema_mismatch",
				title: "Schema mismatch",
				firstSeen: new Date(),
				lastSeen: new Date(),
			},
		});

		const list = await agent
			.get(`/api/incidents?projectId=${projectId}`)
			.expect(200);

		expect(list.body.data).toHaveLength(1);
		expect(list.body.data[0].id).toBe(incident.id);

		const detail = await agent.get(`/api/incidents/${incident.id}`).expect(200);

		expect(detail.body.data.id).toBe(incident.id);
		expect(detail.body.data.diagnosis).toBeNull();

		const updated = await agent
			.patch(`/api/incidents/${incident.id}`)
			.send({ status: "acknowledged" })
			.expect(200);

		expect(updated.body.data.status).toBe("acknowledged");

		await agent.post(`/api/incidents/${incident.id}/diagnose`).expect(202);

		expect(diagnosisAdd).toHaveBeenCalledWith("diagnose-incident", {
			incidentId: incident.id,
		});

		await agent.post(`/api/incidents/${incident.id}/reproduce`).expect(202);

		expect(reproductionAdd).toHaveBeenCalledWith("reproduce-incident", {
			incidentId: incident.id,
		});

		await agent.post(`/api/incidents/${incident.id}/fix`).expect(202);

		expect(fixAdd).toHaveBeenCalledWith("generate-fix", {
			incidentId: incident.id,
		});
	});

	it("authenticates an API key and queues a valid trace payload", async () => {
		const { agent, projectId } = await createAuthenticatedProject();

		const key = await agent
			.post(`/api/projects/${projectId}/keys`)
			.send({})
			.expect(201);

		expect(key.body.data.rawKey).toMatch(/^mod_live_/);

		const payload = {
			resourceAttributes: {
				"modulus.agent.name": "route-test-agent",
			},
			spans: [
				{
					traceId: "trace-1",
					spanId: "span-1",
					name: "tool.test",
					startTimeUnixNano: "1",
				},
			],
		};

		const accepted = await request(app)
			.post("/api/ingest/traces")
			.set("Authorization", `Bearer ${key.body.data.rawKey}`)
			.send(payload)
			.expect(202);

		expect(accepted.body.data.accepted).toBe(true);

		expect(ingestionAdd).toHaveBeenCalledWith(
			"process-trace",
			expect.objectContaining({
				projectId,
				payload: expect.objectContaining({
					resourceAttributes: payload.resourceAttributes,
					spans: expect.arrayContaining([
						expect.objectContaining({
							traceId: "trace-1",
							spanId: "span-1",
						}),
					]),
				}),
			}),
			expect.objectContaining({
				attempts: 5,
			}),
		);

		await request(app)
			.post("/api/ingest/traces")
			.set("Authorization", `Bearer ${key.body.data.rawKey}`)
			.send({})
			.expect(400);
	});
});

afterAll(async () => {
	if (createdProjectIds.length > 0) {
		await prisma.project.deleteMany({
			where: {
				id: {
					in: createdProjectIds,
				},
			},
		});
	}

	if (createdEmails.length > 0) {
		await prisma.user.deleteMany({
			where: {
				email: {
					in: createdEmails,
				},
			},
		});
	}

	await prisma.$disconnect();
});
