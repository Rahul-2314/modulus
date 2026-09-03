import { recordDependencyFailure } from "@modulus/queues/metrics";

import type { LlmProvider } from "../types.js";

export const geminiProvider: LlmProvider = {
	id: "gemini",

	async call(systemPrompt, userPrompt, model) {
		try {
			const apiKey = process.env.GEMINI_API_KEY;

			if (!apiKey) {
				throw new Error("GEMINI_API_KEY is not set");
			}

			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						systemInstruction: {
							parts: [{ text: systemPrompt }],
						},
						contents: [
							{
								role: "user",
								parts: [{ text: userPrompt }],
							},
						],
						generationConfig: {
							responseMimeType: "application/json",
							temperature: 0.2,
						},
					}),
				},
			);

			if (!res.ok) {
				throw new Error(`Gemini call failed: ${res.status} ${res.statusText}`);
			}

			const data = await res.json();

			const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

			const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;

			const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

			return {
				content,
				costUsd: 0,
				inputTokens,
				outputTokens,
				provider: "gemini",
				model,
			};
		} catch (err) {
			await recordDependencyFailure("gemini");
			throw err;
		}
	},
};
