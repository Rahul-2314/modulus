import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import { ModulusClient } from "@modulus/sdk";
import type { LLMResult } from "@langchain/core/outputs";
// import type { AgentAction, AgentFinish } from "@langchain/core/agents";
// import { ChainValues } from "@langchain/core/utils/types";

interface ModulusHandlerConfig {
	apiKey: string;
	agentName: string;
	endpoint?: string;
	commitSha?: string;
	knownTools?: string[];
}

interface ToolRunState {
	toolName: string;
	input: string;
	startedAt: number;
}

const IDLE_FLUSH_MS = 5_000;

export class ModulusCallbackHandler extends BaseCallbackHandler {
	name = "modulus_callback_handler";
	protected client: ModulusClient;
	protected spanIdByRunId = new Map<string, string>();
	private toolRuns = new Map<string, ToolRunState>();
	private llmRuns = new Map<string, { modelName: string; startedAt: number }>();
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private retrieverRuns = new Map<
		string,
		{ query: string; startedAt: number }
	>();

	// constructor
	constructor(config: ModulusHandlerConfig) {
		super();
		this.client = new ModulusClient({
			apiKey: config.apiKey,
			agentName: config.agentName,
			endpoint: config.endpoint,
			commitSha: config.commitSha,
			knownTools: config.knownTools,
		});
	}

	// auto log (failure handling)
	private scheduleFlush() {
		if (this.flushTimer) clearTimeout(this.flushTimer);

		this.flushTimer = setTimeout(() => {
			void this.client.flush().catch(() => {});
			this.flushTimer = null;
		}, IDLE_FLUSH_MS);

		this.flushTimer.unref?.();
	}

	private parentSpanId(parentRunId?: string) {
		return parentRunId ? this.spanIdByRunId.get(parentRunId) : undefined;
	}

	// langchain chain start
	async handleChainStart(
		_chain: Serialized,
		_inputs: unknown,
		runId: string,
		parentRunId?: string,
	) {
		this.spanIdByRunId.set(
			runId,
			this.client.startSpan("chain", {
				startedAt: Date.now(),
				parentSpanId: this.parentSpanId(parentRunId),
			}),
		);
	}

	// handle chain end
	async handleChainEnd(_outputs: unknown, runId: string) {
		const spanId = this.spanIdByRunId.get(runId);
		if (spanId) this.client.endSpan(spanId, { status: "ok" });

		this.scheduleFlush();
	}

	// chain error handling
	async handleChainError(_err: Error, runId: string) {
		const spanId = this.spanIdByRunId.get(runId);
		if (spanId) this.client.endSpan(spanId, { status: "error" });

		this.scheduleFlush();
	}

	// retriever call start
	async handleRetrieverStart(
		_retriever: Serialized,
		query: string,
		runId: string,
	) {
		this.retrieverRuns.set(runId, { query, startedAt: Date.now() });
	}

	// retriever call end
	async handleRetrieverEnd(
		documents: Array<{ metadata?: Record<string, unknown> }>,
		runId: string,
		parentRunId?: string,
	) {
		const run = this.retrieverRuns.get(runId);
		const topScore = documents
			.map((d) =>
				typeof d.metadata?.score === "number" ? d.metadata.score : undefined,
			)
			.filter((s): s is number => s !== undefined)
			.sort((a, b) => b - a)[0];

		this.client.recordRetrieval(run?.query ?? "", {
			topScore,
			resultCount: documents.length,
			startedAt: run?.startedAt ?? Date.now(),
			parentSpanId: this.parentSpanId(parentRunId),
		});
		this.retrieverRuns.delete(runId);
	}

	// tool call start
	async handleToolStart(tool: Serialized, input: string, runId: string) {
		this.toolRuns.set(runId, {
			toolName: String(tool.id.at(-1) ?? "unknown_tool"),
			input,
			startedAt: Date.now(),
		});
	}

	// tool call end
	async handleToolEnd(output: string, runId: string, parentRunId?: string) {
		const run = this.toolRuns.get(runId);
		this.client.recordToolCall(run?.toolName ?? "unknown_tool", run?.input, {
			status: "success",
			response: output,
			startedAt: run?.startedAt ?? Date.now(),
			parentSpanId: this.parentSpanId(parentRunId),
		});
		this.toolRuns.delete(runId);
	}

	// tool call error handling
	async handleToolError(err: Error, runId: string, parentRunId?: string) {
		const run = this.toolRuns.get(runId);
		this.client.recordToolCall(run?.toolName ?? "unknown_tool", run?.input, {
			status: "error",
			response: { message: err.message },
			startedAt: run?.startedAt ?? Date.now(),
			parentSpanId: this.parentSpanId(parentRunId),
		});
		this.toolRuns.delete(runId);
	}

	// model(llm) call start
	async handleLLMStart(llm: Serialized, _prompts: string[], runId: string) {
		this.llmRuns.set(runId, {
			modelName: String(llm.id.at(-1) ?? "unknown_model"),
			startedAt: Date.now(),
		});
	}

	// model(llm) call end
	async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string) {
		const run = this.llmRuns.get(runId);
		const text = output?.generations?.[0]?.[0]?.text ?? "";
		this.client.recordModelCall(run?.modelName ?? "unknown_model", {
			output: text,
			status: "success",
			startedAt: run?.startedAt ?? Date.now(),
			parentSpanId: this.parentSpanId(parentRunId),
		});
		this.llmRuns.delete(runId);
	}

	// model(llm) error handling
	async handleLLMError(err: Error, runId: string, parentRunId?: string) {
		const run = this.llmRuns.get(runId);
		this.client.recordModelCall(run?.modelName ?? "unknown_model", {
			output: err.message,
			status: "error",
			startedAt: run?.startedAt ?? Date.now(),
			parentSpanId: this.parentSpanId(parentRunId),
		});
		this.llmRuns.delete(runId);
	}
}