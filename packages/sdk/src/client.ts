interface ModulusClientConfig {
	apiKey: string;
	endpoint?: string;
	agentName: string;
	commitSha?: string; // commitSha through the fallback SDK, not just raw OTel senders
	knownTools?: string[];
}

interface SpanRecord {
	traceId: string;
	spanId: string;
	parentSpanId?: string;
	name: string;
	startTimeUnixNano: string;
	endTimeUnixNano?: string;
	status: "ok" | "error" | "unset";
	attributes: Record<string, unknown>;
}

export class ModulusClient {
	private spans: SpanRecord[] = [];
	private traceId = crypto.randomUUID().replace(/-/g, "");

	constructor(private config: ModulusClientConfig) {}

	private newSpanId(): string {
		return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
	}

	recordToolCall(
		toolName: string,
		args: unknown,
		opts: {
			status: "success" | "error";
			response?: unknown;
			startedAt: number;
			parentSpanId?: string;
		},
	) {
		this.spans.push({
			traceId: this.traceId,
			spanId: this.newSpanId(),
			parentSpanId: opts.parentSpanId,
			name: `tool.${toolName}`,
			startTimeUnixNano: String(opts.startedAt * 1_000_000),
			endTimeUnixNano: String(Date.now() * 1_000_000),
			status: opts.status === "error" ? "error" : "ok",
			attributes: {
				"modulus.tool.name": toolName,
				"modulus.tool.arguments": args,
				"modulus.tool.response": opts.response,
			},
		});
	}

	// LLM/model calls
	recordModelCall(
		modelName: string,
		opts: {
			output: string;
			status: "success" | "error";
			startedAt: number;
			costALO?: number;
			parentSpanId?: string;
		},
	) {
		this.spans.push({
			traceId: this.traceId,
			spanId: this.newSpanId(),
			parentSpanId: opts.parentSpanId,
			name: `model.${modelName}`,
			startTimeUnixNano: String(opts.startedAt * 1_000_000),
			endTimeUnixNano: String(Date.now() * 1_000_000),
			status: opts.status === "error" ? "error" : "ok",
			attributes: {
				"modulus.model.name": modelName,
				"modulus.model.output": opts.output,
				...(opts.costALO !== undefined
					? { "modulus.model.cost_alo": opts.costALO }
					: {}),
			},
		});
	}

	// retrieval call
	recordRetrieval(
		query: string,
		opts: {
			topScore?: number;
			resultCount: number;
			startedAt: number;
			parentSpanId?: string;
		},
	) {
		this.spans.push({
			traceId: this.traceId,
			spanId: this.newSpanId(),
			parentSpanId: opts.parentSpanId,
			name: "retrieval",
			startTimeUnixNano: String(opts.startedAt * 1_000_000),
			endTimeUnixNano: String(Date.now() * 1_000_000),
			status: "ok",
			attributes: {
				"modulus.retrieval.query": query,
				"modulus.retrieval.result_count": opts.resultCount,
				...(opts.topScore !== undefined
					? { "modulus.retrieval.top_score": opts.topScore }
					: {}),
			},
		});
	}

	// generic chain/workflow spans
	startSpan(
		name: string,
		opts: { startedAt: number; parentSpanId?: string },
	): string {
		const spanId = this.newSpanId();
		this.spans.push({
			traceId: this.traceId,
			spanId,
			parentSpanId: opts.parentSpanId,
			name,
			startTimeUnixNano: String(opts.startedAt * 1_000_000),
			status: "unset",
			attributes: {},
		});
		return spanId;
	}

	tagSpan(spanId: string, key: string, value: unknown) {
		const span = this.spans.find((s) => s.spanId === spanId);
		if (span) span.attributes[key] = value;
	}

	endSpan(spanId: string, opts: { status: "ok" | "error" }) {
		const span = this.spans.find((s) => s.spanId === spanId);
		if (span) {
			span.endTimeUnixNano = String(Date.now() * 1_000_000);
			span.status = opts.status;
		}
	}

	get currentTraceId() {
		return this.traceId;
	}

	async flush(): Promise<void> {
		if (!this.spans.length) return;
		const batch = this.spans.splice(0);

		try {
			await fetch(
				`${this.config.endpoint ?? "https://ingest.modulus.dev"}/api/ingest/traces`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.config.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						resourceAttributes: {
							"modulus.agent.name": this.config.agentName,
							"modulus.agent.framework": "langchain",
							...(this.config.commitSha
								? { "modulus.git.commit_sha": this.config.commitSha }
								: {}),
							...(this.config.knownTools
								? { "modulus.agent.tools": this.config.knownTools }
								: {}),
						},
						spans: batch,
					}),
				},
			);
		} catch {
			// swallow — telemetry must never break the agent
		}
	}
}
