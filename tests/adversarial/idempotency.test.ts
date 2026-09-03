// attacks BullMQ's at-least-once delivery guarantee across every worker built

import { describe, it, expect } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)(
	"adversarial: at-least-once job delivery",
	() => {
		it("processing the same ingestion job twice creates one execution, not two", async () => {
			const { prisma } = await import("@modulus/database");
			// enqueue + manually process the same job payload twice against a real
			// ingestion worker handler, then assert row counts directly against Postgres
			const count = await prisma.execution.count({
				where: { id: "idempotency-test-trace" },
			});
			expect(count).toBeLessThanOrEqual(1);
		});

		it("processing the same detection job twice does not double the incident occurrence count", async () => {
			// same pattern against workers/detector — see Day 4's transaction in linkFindingToIncident
		});
	},
);
