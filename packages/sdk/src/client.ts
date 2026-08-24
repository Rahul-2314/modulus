interface ModulusClientConfig {
	apiKey: string;
	endpoint?: string; // defaults to Modulus cloud ingestion URL
	agentName: string;
}

export class ModulusClient {
	private spans: any[] = [];
	private traceId = crypto.randomUUID().replace(/-/g, "");

	constructor(private config: ModulusClientConfig) {}

	recordToolCall(
		toolName: string,
		args: unknown,
		opts: {
			status: "success" | "error";
			response?: unknown;
			startedAt: number;
		},
	) {
		const now = Date.now();
		this.spans.push({
			traceId: this.traceId,
			spanId: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
			name: `tool.${toolName}`,
			startTimeUnixNano: String(opts.startedAt * 1_000_000),
			endTimeUnixNano: String(now * 1_000_000),
			status: opts.status === "error" ? "error" : "ok",
			attributes: {
				"modulus.tool.name": toolName,
				"modulus.tool.arguments": args,
				"modulus.tool.response": opts.response,
			},
		});
	}

	// Fire-and-forget: never await this in the caller's critical path, and
	// never let a failure here throw into the agent's own code (§5's
	// non-blocking requirement applies to this path too).
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
						resourceAttributes: { "modulus.agent.name": this.config.agentName },
						spans: batch,
					}),
				},
			);
		} catch {
			// swallow — telemetry must never break the agent. Bounded retry can
			// be added here later (single retry, short timeout) without changing
			// the public API.
		}
	}
}
