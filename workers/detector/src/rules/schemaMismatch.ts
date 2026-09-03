import { Rule } from "./types.js";

const MISMATCH_PATTERN =
	/expected .* (received|got)|type mismatch|invalid type/i;

export const schemaMismatchRule: Rule = {
	id: "schema_mismatch",
	evaluate({ toolCalls }) {
		const mismatch = toolCalls.find((t) => {
			const response = t.response as { message?: string } | null;
			return (
				t.status === "error" && MISMATCH_PATTERN.test(response?.message ?? "")
			);
		});

		if (!mismatch) return null;
		return {
			ruleId: this.id,
			title: `Tool "${mismatch.toolName}" received a schema/type mismatch`,
			severity: "medium",
			evidence: { toolCallId: mismatch.id, response: mismatch.response },
		};
	},
};
