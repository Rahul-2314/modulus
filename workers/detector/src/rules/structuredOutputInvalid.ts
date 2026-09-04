import { Rule } from "./types.js";

export const structuredOutputInvalidRule: Rule = {
	id: "structured_output_invalid",
	evaluate({ events }) {
		const invalid = events.find((e) => {
			if (e.type !== "model_call") return false;
			const payload = e.payload as { attributes?: Record<string, unknown> };
			const output = payload.attributes?.["modulus.model.output"];
			if (typeof output !== "string") return false;
			try {
				JSON.parse(output);
				return false;
			} catch {
				return true;
			}
		});

		if (!invalid) return null;
		return {
			ruleId: this.id,
			title: "Model produced invalid structured output",
			severity: "high",
			evidence: { eventId: invalid.id },
		};
	},
};
