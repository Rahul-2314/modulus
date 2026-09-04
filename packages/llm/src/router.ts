import { groqProvider } from "./providers/groq.js";
import { geminiProvider } from "./providers/gemini.js";

import type { LlmProvider, LlmCallResult, CostTier } from "./types.js";

const MODEL_TABLE: Record<string, Record<CostTier, string>> = {
	groq: {
		standard: "llama-3.3-70b-versatile",
		economy: "llama-3.1-8b-instant",
	},

	gemini: {
		standard: "gemini-1.5-flash",
		economy: "gemini-1.5-flash",
	},
};

const PROVIDER_CHAIN: LlmProvider[] = [groqProvider, geminiProvider];

export async function callStructuredModel(
	systemPrompt: string,
	userPrompt: string,
	opts: { tier?: CostTier } = {},
): Promise<LlmCallResult & { fellBack: boolean }> {
	const tier = opts.tier ?? "standard";

	let lastError: unknown;

	for (const [index, provider] of PROVIDER_CHAIN.entries()) {
		try {
			const model = MODEL_TABLE[provider.id]?.[tier];

			if (!model) {
				throw new Error(
					`No model configured for provider "${provider.id}" and tier "${tier}"`,
				);
			}

			const result = await provider.call(systemPrompt, userPrompt, model);

			return {
				...result,
				fellBack: index > 0,
			};
		} catch (err) {
			lastError = err;
		}
	}

	throw new Error(`All LLM providers failed. Last error: ${String(lastError)}`);
}

// Existing diagnostician/fixer imports remain unchanged.
export const callDiagnosisModel = callStructuredModel;

export type { CostTier };
