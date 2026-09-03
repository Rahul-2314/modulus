import { Rule } from "./types.js";

const TIMEOUT_THRESHOLD_MS = 30_000;

export const timeoutRetryRule: Rule = {
	id: "timeout_retry",
	evaluate({ toolCalls }) {
		const slow = toolCalls.find((t) => t.latencyMs > TIMEOUT_THRESHOLD_MS);
		if (!slow) return null;
		return {
			ruleId: this.id,
			title: `Tool "${slow.toolName}" exceeded the timeout threshold`,
			severity: "low",
			evidence: { toolCallId: slow.id, latencyMs: slow.latencyMs },
		};
	},
};
