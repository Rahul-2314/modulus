import { Rule } from "./types.js";

const CHAIN_RECURSION_THRESHOLD = 15;

type ChainPayload = {
	spanId?: string;
	parentSpanId?: string;
};

export const chainRecursionLimitRule: Rule = {
	id: "chain_recursion_limit",
	evaluate({ events }) {
		const chainEvents = events.filter((e) => e.type === "chain");
		if (chainEvents.length === 0) return null;

		const getPayload = (event: (typeof chainEvents)[number]): ChainPayload =>
			event.payload as ChainPayload;

		const byId = new Map(
			chainEvents
				.map((e) => {
					const payload = getPayload(e);
					return payload.spanId ? ([payload.spanId, e] as const) : null;
				})
				.filter(
					(entry): entry is readonly [string, (typeof chainEvents)[number]] =>
						entry !== null,
				),
		);

		let maxDepth = 0;

		for (const event of chainEvents) {
			let depth = 0;
			let current: ChainPayload = getPayload(event);
			const seen = new Set<string>();

			while (current.parentSpanId && byId.has(current.parentSpanId)) {
				if (current.spanId && seen.has(current.spanId)) {
					break;
				}

				if (current.spanId) {
					seen.add(current.spanId);
				}

				depth++;

				const parentEvent = byId.get(current.parentSpanId);

				if (!parentEvent) break;

				current = getPayload(parentEvent);
			}

			maxDepth = Math.max(maxDepth, depth);
		}

		if (maxDepth < CHAIN_RECURSION_THRESHOLD) return null;

		return {
			ruleId: this.id,
			title: `Chain nesting exceeded ${CHAIN_RECURSION_THRESHOLD} levels — possible runaway recursion`,
			severity: "high",
			evidence: { maxDepth },
		};
	},
};
