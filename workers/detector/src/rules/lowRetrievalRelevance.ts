import { Rule } from "./types.js";

const LOW_RELEVANCE_THRESHOLD = 0.3;

type RetrievalPayload = {
	attributes?: Record<string, unknown>;
};

export const lowRetrievalRelevanceRule: Rule = {
	id: "low_retrieval_relevance",
	evaluate({ events }) {
		const weak = events.find((e) => {
			if (e.type !== "retrieval") return false;

			const payload = e.payload as RetrievalPayload;
			const topScore = payload.attributes?.["modulus.retrieval.top_score"];

			return typeof topScore === "number" && topScore < LOW_RELEVANCE_THRESHOLD;
		});

		if (!weak) return null;

		const payload = weak.payload as RetrievalPayload;
		const topScore = payload.attributes?.["modulus.retrieval.top_score"];

		return {
			ruleId: this.id,
			title: "Retrieval returned only low-relevance results",
			severity: "medium",
			evidence: {
				eventId: weak.id,
				topScore,
			},
		};
	},
};
