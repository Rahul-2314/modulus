import { ModulusCallbackHandler } from "@modulus/adapter-langchain";
import type { Serialized } from "@langchain/core/load/serializable";

export class ModulusLangGraphHandler extends ModulusCallbackHandler {
	async handleChainStart(
		chain: Serialized,
		inputs: unknown,
		runId: string,
		parentRunId?: string,
		_tags?: string[],
		metadata?: Record<string, unknown>,
	) {
		await super.handleChainStart(chain, inputs, runId, parentRunId);
		const nodeName = metadata?.langgraph_node as string | undefined;
		const spanId = this.spanIdByRunId.get(runId);
		if (nodeName && spanId)
			this.client.tagSpan(spanId, "modulus.graph.node", nodeName);
	}
}
