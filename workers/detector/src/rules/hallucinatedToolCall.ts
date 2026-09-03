import { Rule } from "./types.js";

export const hallucinatedToolCallRule: Rule = {
	id: "hallucinated_tool_call",
	evaluate({ agent, toolCalls }) {
		if (!agent.knownTools?.length) return null; // no declared allow-list — skip rather than false-positive on undeclared agents

		const rogue = toolCalls.find((t) => !agent.knownTools.includes(t.toolName));
		if (!rogue) return null;
		return {
			ruleId: this.id,
			title: `Agent called an unregistered tool: "${rogue.toolName}"`,
			severity: "high",
			evidence: {
				toolCallId: rogue.id,
				toolName: rogue.toolName,
				knownTools: agent.knownTools,
			},
		};
	},
};
