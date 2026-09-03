import { redact } from "@modulus/otel-core/redact";
import type { Execution, ToolCall } from "@modulus/database";

export interface ReproductionFixture {
	executionId: string;
	input: unknown;
	toolCallSequence: Array<{
		toolName: string;
		arguments: unknown;
		mockResponse: unknown;
		mockStatus: "success" | "error";
	}>;
	expectedFailureSignature: string;
}

export function buildFixture(
	execution: Execution & { toolCalls: ToolCall[] },
	failureTitle: string,
): string {
	const fixture: ReproductionFixture = {
		executionId: execution.id,
		input: redact(execution.input),
		toolCallSequence: execution.toolCalls.map((t) => ({
			toolName: t.toolName,
			arguments: redact(t.arguments),
			mockResponse: redact(t.response),
			mockStatus: t.status,
		})),
		expectedFailureSignature: failureTitle,
	};
	return JSON.stringify(fixture);
}
