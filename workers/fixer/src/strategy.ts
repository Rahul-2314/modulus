export interface FixStrategy {
	id: string;
	defaultRisk: "low" | "medium" | "high";
	instruction: string;
}

const STRATEGIES: Record<string, FixStrategy> = {
	tool_api_error: {
		id: "add_retry_config",
		defaultRisk: "low",
		instruction:
			"Add or increase retry configuration with exponential backoff around the failing tool call.",
	},
	schema_mismatch: {
		id: "fix_tool_parameter_mapping",
		defaultRisk: "low",
		instruction:
			"Correct the tool call's parameter mapping so its shape matches what the tool expects.",
	},
	timeout_retry: {
		id: "adjust_timeout_config",
		defaultRisk: "low",
		instruction:
			"Increase the timeout threshold or retry policy for the slow operation.",
	},
	structured_output_invalid: {
		id: "add_output_validation",
		defaultRisk: "medium",
		instruction:
			"Add validation/repair logic around the model's structured output before it's used downstream.",
	},
	repeated_tool_loop: {
		id: "fix_workflow_logic",
		defaultRisk: "medium",
		instruction:
			"Adjust the agent's control flow to prevent the same tool call from repeating without making progress.",
	},
	rag_retrieval_issue: {
		id: "fix_workflow_logic",
		defaultRisk: "medium",
		instruction:
			"Adjust the retrieval query or fallback logic so empty results are handled explicitly.",
	},
	chain_recursion_limit: {
		id: "fix_workflow_logic",
		defaultRisk: "medium",
		instruction:
			"Add a recursion/loop guard or max-depth check to the chain's control flow.",
	},
	low_retrieval_relevance: {
		id: "fix_workflow_logic",
		defaultRisk: "medium",
		instruction:
			"Tune the retrieval query, add a relevance threshold, or add a fallback when top results score low.",
	},
	context_window_overflow: {
		id: "add_context_truncation",
		defaultRisk: "low",
		instruction:
			"Add truncation or summarization of older context before it approaches the model's context window.",
	},
};

export function selectStrategy(ruleId: string): FixStrategy {
	return (
		STRATEGIES[ruleId] ?? {
			id: "manual_review_required",
			defaultRisk: "high",
			instruction: "",
		}
	);
}
