import { z } from "zod";

export const otelAttributeSchema = z.record(z.string(), z.unknown());

export const otelSpanSchema = z.object({
	traceId: z.string().min(1),
	spanId: z.string().min(1),
	parentSpanId: z.string().optional(),
	name: z.string(),
	startTimeUnixNano: z.string(),
	endTimeUnixNano: z.string().optional(),
	status: z.enum(["ok", "error", "unset"]).default("unset"),
	attributes: otelAttributeSchema.default({}),
});

export const ingestPayloadSchema = z.object({
	resourceAttributes: z.object({
		"modulus.agent.name": z.string(),
		"modulus.agent.framework": z.string().optional(),
		"modulus.adapter.version": z.string().optional(),
		"modulus.git.commit_sha": z.string().optional(), // codebase git commit track
		"modulus.agent.tools": z.array(z.string()).optional(),	// tool call track
	}),
	spans: z.array(otelSpanSchema).min(1).max(500), // bounded batch size
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
export type OtelSpan = z.infer<typeof otelSpanSchema>;
