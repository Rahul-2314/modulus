import { Rule } from "./types.js";
import { toolApiErrorRule } from "./toolApiError.js";
import { schemaMismatchRule } from "./schemaMismatch.js";
import { structuredOutputInvalidRule } from "./structuredOutputInvalid.js";
import { timeoutRetryRule } from "./timeoutRetry.js";
import { repeatedToolLoopRule } from "./repeatedToolLoop.js";
import { ragRetrievalIssueRule } from "./ragRetrievalIssue.js";
import { chainRecursionLimitRule } from "./chainRecursionLimit.js";
import { lowRetrievalRelevanceRule } from "./lowRetrievalRelevance.js";
import { contextWindowOverflowRule } from "./contextWindowOverflow.js";
import { hallucinatedToolCallRule } from "./hallucinatedToolCall.js";

export const rules: Rule[] = [
	toolApiErrorRule,
	schemaMismatchRule,
	structuredOutputInvalidRule,
	timeoutRetryRule,
	repeatedToolLoopRule,
	ragRetrievalIssueRule,
	chainRecursionLimitRule,
	lowRetrievalRelevanceRule,
	contextWindowOverflowRule,
	hallucinatedToolCallRule,
] satisfies Rule[];
