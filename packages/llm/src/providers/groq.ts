import Groq from "groq-sdk";

import { recordDependencyFailure } from "@modulus/queues/metrics";

import type { LlmProvider } from "../types.js";

const groq = new Groq({
	apiKey: process.env.GROQ_API_KEY!,
});

export const DIAGNOSIS_MODEL =
	process.env.DIAGNOSIS_MODEL ?? "llama-3.3-70b-versatile";

// Cost calculation table (USD per 1 million tokens)
export const MODEL_PRICING_USD: Record<
	string,
	{
		inputPerMillion: number;
		outputPerMillion: number;
	}
> = {
	"openai/gpt-oss-120b": {
		inputPerMillion: 0.15,
		outputPerMillion: 0.6,
	},
	"openai/gpt-oss-20b": {
		inputPerMillion: 0.075,
		outputPerMillion: 0.3,
	},
	"llama-3.3-70b-versatile": {
		inputPerMillion: 0,
		outputPerMillion: 0,
	},
	"llama-3.1-8b-instant": {
		inputPerMillion: 0,
		outputPerMillion: 0,
	},
} as const;

export interface LlmCallResult {
	content: string;
	costUsd: number;
	inputTokens: number;
	outputTokens: number;
}

function calculateCostUsd(
	model: string,
	inputTokens: number,
	outputTokens: number,
): number {
	const pricing = MODEL_PRICING_USD[model];

	if (!pricing) {
		return 0;
	}

	const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;

	const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

	return inputCost + outputCost;
}

// Generic structured-call helper
export async function callStructuredModel(
	systemPrompt: string,
	userPrompt: string,
	model: string = DIAGNOSIS_MODEL,
): Promise<LlmCallResult> {
	try {
		const completion = await groq.chat.completions.create({
			model,
			response_format: {
				type: "json_object",
			},
			temperature: 0.2,
			messages: [
				{
					role: "system",
					content: systemPrompt,
				},
				{
					role: "user",
					content: userPrompt,
				},
			],
		});

		const content = completion.choices[0]?.message?.content ?? "";

		const inputTokens = completion.usage?.prompt_tokens ?? 0;

		const outputTokens = completion.usage?.completion_tokens ?? 0;

		const costUsd = calculateCostUsd(model, inputTokens, outputTokens);

		return {
			content,
			costUsd,
			inputTokens,
			outputTokens,
		};
	} catch (err) {
		await recordDependencyFailure("groq");
		throw err;
	}
}

// Groq implementation of the generic LLM provider interface. (cost calculation cetralized)
export const groqProvider: LlmProvider = {
	id: "groq",

	async call(systemPrompt, userPrompt, model) {
		const result = await callStructuredModel(systemPrompt, userPrompt, model);

		return {
			...result,
			provider: "groq",
			model,
		};
	},
};

// Kept as an alias so existing call sites need no changes.
export const callDiagnosisModel = callStructuredModel;
