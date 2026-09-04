from typing import Any, Optional
from uuid import UUID
from modulus_adapter_langchain import ModulusCallbackHandler


class ModulusLangGraphHandler(ModulusCallbackHandler):
    def on_chain_start(self, serialized: dict, inputs: dict, *, run_id: UUID, parent_run_id: Optional[UUID] = None,
                       metadata: Optional[dict] = None, **kwargs: Any) -> None:
        super().on_chain_start(serialized, inputs, run_id=run_id,
                               parent_run_id=parent_run_id, metadata=metadata, **kwargs)
        node_name = (metadata or {}).get("langgraph_node")
        span_id = self._span_by_run_id.get(str(run_id))
        if node_name and span_id:
            self.client.tag_span(span_id, "modulus.graph.node", node_name)
