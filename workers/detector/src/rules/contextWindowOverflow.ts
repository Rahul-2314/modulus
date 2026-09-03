import { Rule } from "./types.js";

const CONTEXT_OVERFLOW_PATTERN =
	/context_length_exceeded|maximum context length|context window|token limit exceeded/i;

type ModelCallPayload = {
	attributes?: Record<string, unknown>;
};

export const contextWindowOverflowRule: Rule = {
	id: "context_window_overflow",
	evaluate({ events }) {
		const overflow = events.find((e) => {
			if (e.type !== "model_call") return false;

			const payload = e.payload as ModelCallPayload;
			const output = payload.attributes?.["modulus.model.output"];

			return (
				typeof output === "string" && CONTEXT_OVERFLOW_PATTERN.test(output)
			);
		});

		if (!overflow) return null;

		return {
			ruleId: this.id,
			title: "Model call failed due to context window overflow",
			severity: "high",
			evidence: { eventId: overflow.id },
		};
	},
};
