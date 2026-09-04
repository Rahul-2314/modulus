export interface LlmCallResult {
	content: string;
	costUsd: number;
	inputTokens: number;
	outputTokens: number;
	provider: string;
	model: string;
}

export interface LlmProvider {
	id: string;

	call(
		systemPrompt: string,
		userPrompt: string,
		model: string,
	): Promise<LlmCallResult>;
}

export type CostTier = "standard" | "economy";
