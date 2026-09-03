import type { Execution, ExecutionEvent, ToolCall, Agent } from "@modulus/database";

export interface ExecutionContext {
	execution: Execution;
	agent: Agent;
	toolCalls: ToolCall[];
	events: ExecutionEvent[];
}

export interface Finding {
	ruleId: string;
	title: string;
	severity: "low" | "medium" | "high" | "critical";
	evidence: Record<string, unknown>;
}

export interface Rule {
	id: string;
	evaluate(ctx: ExecutionContext): Finding | null;
}
