import { Rule } from "./types.js";

export const ragRetrievalIssueRule: Rule = {
	id: "rag_retrieval_issue",
	evaluate({ events }) {
		const emptyRetrieval = events.find((e) => {
			if (e.type !== "retrieval") return false;
			const payload = e.payload as { attributes?: Record<string, unknown> };
			return payload.attributes?.["modulus.retrieval.result_count"] === 0;
		});
		if (!emptyRetrieval) return null;
		return {
			ruleId: this.id,
			title: "Retrieval returned no results",
			severity: "medium",
			evidence: { eventId: emptyRetrieval.id },
		};
	},
};
