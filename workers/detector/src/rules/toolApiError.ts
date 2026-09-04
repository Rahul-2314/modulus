import { Rule } from "./types.js";

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

export const toolApiErrorRule: Rule = {
	id: "tool_api_error",
	evaluate({ toolCalls }) {
		const failed = toolCalls.find((t) => {
			if (t.status !== "error") return false;
			const response = t.response as {
				statusCode?: number;
				message?: string;
			} | null;
			return (
				RETRYABLE_STATUS_CODES.includes(response?.statusCode ?? 0) ||
				/timeout/i.test(response?.message ?? "")
			);
		});

		if (!failed) return null;
		return {
			ruleId: this.id,
			title: `Tool "${failed.toolName}" returned a retryable error`,
			severity: "medium",
			evidence: {
				toolCallId: failed.id,
				toolName: failed.toolName,
				response: failed.response,
			},
		};
	},
};
