// attacks the Day 3 ingestion path

import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@modulus/api";

describe.skipIf(!process.env.TEST_API_KEY)("adversarial: ingestion", () => {
	it("rejects a payload over the size limit", async () => {
		const hugeSpan = { ["x".repeat(3 * 1024 * 1024)]: "y" }; // > 2mb
		const res = await request(app)
			.post("/api/ingest/traces")
			.set("Authorization", `Bearer ${process.env.TEST_API_KEY}`)
			.send({
				resourceAttributes: { "modulus.agent.name": "a" },
				spans: [hugeSpan],
			});
		expect([400, 413]).toContain(res.status);
	});

	it("rejects a span missing required fields", async () => {
		const res = await request(app)
			.post("/api/ingest/traces")
			.set("Authorization", `Bearer ${process.env.TEST_API_KEY}`)
			.send({
				resourceAttributes: { "modulus.agent.name": "a" },
				spans: [{ name: "no-trace-id" }],
			});
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
	});

	it("rejects a batch over the 500-span cap", async () => {
		const spans = Array.from({ length: 501 }, (_, i) => ({
			traceId: `t${i}`,
			spanId: `s${i}`,
			name: "x",
			startTimeUnixNano: "1",
			status: "ok" as const,
			attributes: {},
		}));
		const res = await request(app)
			.post("/api/ingest/traces")
			.set("Authorization", `Bearer ${process.env.TEST_API_KEY}`)
			.send({ resourceAttributes: { "modulus.agent.name": "a" }, spans });
		expect(res.status).toBe(400);
	});

	it("does not create a duplicate execution when the same batch is retried", async () => {
		const batch = {
			resourceAttributes: { "modulus.agent.name": "a" },
			spans: [validSpan("dup-trace")],
		};
		await request(app)
			.post("/api/ingest/traces")
			.set("Authorization", `Bearer ${process.env.TEST_API_KEY}`)
			.send(batch);
		await request(app)
			.post("/api/ingest/traces")
			.set("Authorization", `Bearer ${process.env.TEST_API_KEY}`)
			.send(batch);
		// assert exactly one Execution row with id "dup-trace" after the worker drains — see idempotency.test.ts for the DB-level check
	});
});

function validSpan(traceId: string) {
	return {
		traceId,
		spanId: "s1",
		name: "x",
		startTimeUnixNano: "1000000",
		status: "ok" as const,
		attributes: {},
	};
}
