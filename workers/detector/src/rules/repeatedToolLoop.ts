import { Rule } from "./types.js";

const REPEAT_THRESHOLD = 5;

export const repeatedToolLoopRule: Rule = {
	id: "repeated_tool_loop",
	evaluate({ toolCalls }) {
		const counts = new Map<string, number>();
		for (const t of toolCalls) {
			const key = `${t.toolName}:${JSON.stringify(t.arguments)}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}

		const looping = [...counts.entries()].find(
			([, count]) => count >= REPEAT_THRESHOLD,
		);
		if (!looping) return null;

		const [key, count] = looping;
		return {
			ruleId: this.id,
			title: `Same tool call repeated ${count} times in one execution`,
			severity: "medium",
			evidence: { key, count },
		};
	},
};
