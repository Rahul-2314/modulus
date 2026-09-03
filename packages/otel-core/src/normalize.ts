import type { IngestPayload, OtelSpan } from "./schema.js";

export type ExecutionStatus = "running" | "succeeded" | "failed";

// export type EventType = "span" | "model_call" | "tool_call" | "error";
export type EventType = "span" | "chain" | "retrieval" | "model_call" | "tool_call" | "error";

export interface NormalizedExecution {
	executionId: string;
	agentName: string;
	framework?: string;
	adapterVersion?: string;
	commitSha?: string;
	startedAt: Date;
	endedAt?: Date;
	status: ExecutionStatus;
	events: NormalizedEvent[];
	toolCalls: NormalizedToolCall[];
	knownTools?: string[];
	costALO?: number;
}

export interface NormalizedEvent {
	type: EventType;
	timestamp: Date;
	payload: Record<string, unknown>;
}

export interface NormalizedToolCall {
	toolName: string;
	arguments: unknown;
	response?: unknown;
	status: "success" | "error";
	latencyMs: number;
}

/**
 * Converts a Unix timestamp in nanoseconds to a JavaScript Date.
 */
function nsToDate(ns: string): Date {
	const milliseconds = BigInt(ns) / 1_000_000n;

	return new Date(Number(milliseconds));
}

/**
 * Returns the root span of the trace.
 *
 * Falls back to the first span when ingesting a partial trace
 * where the actual root span may not be present.
 */
function getRootSpan(spans: OtelSpan[]): OtelSpan {
	const firstSpan = spans[0];

	if (!firstSpan) {
		throw new Error("Cannot normalize payload with no spans");
	}

	return spans.find((span) => !span.parentSpanId) ?? firstSpan;
}


// Determines the normalized event type.
function classifyEventType(s: OtelSpan): EventType {
	if (s.status === "error") return "error";
	if (s.name === "chain") return "chain";
	if (s.attributes["modulus.retrieval.result_count"] !== undefined)
		return "retrieval";
	if (s.attributes["modulus.tool.name"] !== undefined)
		return "tool_call";
	if (s.attributes["modulus.model.name"] !== undefined)
		return "model_call";
	return "span";
}

// Calculates span duration in milliseconds.
function getLatencyMs(span: OtelSpan): number {
	if (!span.endTimeUnixNano) {
		return 0;
	}

	const start = BigInt(span.startTimeUnixNano);
	const end = BigInt(span.endTimeUnixNano);

	// Protect against malformed timestamps.
	if (end < start) {
		return 0;
	}

	return Number((end - start) / 1_000_000n);
}


// Converts an OTel span representing a tool invocation
// into Modulus's normalized tool call format.
function toToolCall(span: OtelSpan): NormalizedToolCall {
	const response = span.attributes["modulus.tool.response"];

	return {
		toolName: String(span.attributes["modulus.tool.name"]),

		arguments: span.attributes["modulus.tool.arguments"] ?? {},

		...(response !== undefined ? { response } : {}),

		status: span.status === "error" ? "error" : "success",

		latencyMs: getLatencyMs(span),
	};
}


// Normalizes a raw OpenTelemetry ingest payload
// into Modulus's internal execution representation.

export function normalizeIngestPayload(
	payload: IngestPayload,
): NormalizedExecution {
	const rootSpan = getRootSpan(payload.spans);

	const events: NormalizedEvent[] = payload.spans.map((span) => ({
		type: classifyEventType(span),

		timestamp: nsToDate(span.startTimeUnixNano),

		payload: {
			name: span.name,
			traceId: span.traceId,
			spanId: span.spanId,
			parentSpanId: span.parentSpanId,
			attributes: span.attributes,
		},
	}));

	const toolCalls: NormalizedToolCall[] = payload.spans
		.filter((span) => span.attributes["modulus.tool.name"] !== undefined)
		.map(toToolCall);

	const hasError = payload.spans.some((span) => span.status === "error");

	const framework = payload.resourceAttributes["modulus.agent.framework"];

	const adapterVersion = payload.resourceAttributes["modulus.adapter.version"];

	const commitSha = payload.resourceAttributes["modulus.git.commit_sha"];

	const knownTools = payload.resourceAttributes["modulus.agent.tools"];

	const endedAt = rootSpan.endTimeUnixNano
		? nsToDate(rootSpan.endTimeUnixNano)
		: undefined;

	const status: ExecutionStatus = hasError
		? "failed"
		: endedAt
			? "succeeded"
			: "running";

	const costALO = payload.spans.reduce((sum, s) => {
		const cost = s.attributes["modulus.model.cost_alo"];
		return typeof cost === "number" ? sum + cost : sum;
	}, 0);

	return {
		executionId: rootSpan.traceId,

		agentName: payload.resourceAttributes["modulus.agent.name"] ?? "unknown",

		...(framework !== undefined ? { framework } : {}),

		...(adapterVersion !== undefined ? { adapterVersion } : {}),

		...(commitSha !== undefined ? { commitSha } : {}),

		...(knownTools !== undefined ? { knownTools } : {}),

		startedAt: nsToDate(rootSpan.startTimeUnixNano),

		...(endedAt !== undefined ? { endedAt } : {}),

		status,

		events,

		toolCalls,

		costALO: costALO > 0 ? costALO : undefined,
	};
}


// pipeline :
// Incoming OTel Payload
//         ↓
// validateIngestPayload()
//         ↓
// normalizeIngestPayload()
//         ↓
// NormalizedExecution
//         ↓
// Prisma persistence layer