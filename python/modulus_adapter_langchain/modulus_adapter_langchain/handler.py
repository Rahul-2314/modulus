import time
import asyncio
from typing import Any, Optional
from uuid import UUID
from langchain_core.callbacks import BaseCallbackHandler
from modulus_sdk import ModulusClient


class ModulusCallbackHandler(BaseCallbackHandler):
    def __init__(self, api_key: str, agent_name: str, endpoint: str = "https://ingest.modulus.dev",
                 commit_sha: Optional[str] = None, known_tools: Optional[list[str]] = None):
        super().__init__()
        self.client = ModulusClient(api_key=api_key, agent_name=agent_name, endpoint=endpoint,
                                    framework="langchain", commit_sha=commit_sha, known_tools=known_tools)
        self._span_by_run_id: dict[str, str] = {}
        self._tool_runs: dict[str, tuple[str, Any, int]] = {}
        self._llm_runs: dict[str, tuple[str, int]] = {}
        self._flush_handle: Optional[asyncio.TimerHandle] = None

    def _parent_span_id(self, parent_run_id: Optional[UUID]) -> Optional[str]:
        return self._span_by_run_id.get(str(parent_run_id)) if parent_run_id else None

    def _schedule_flush(self):
        #idle flush. (`await handler.client.flush()` explicitly)
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        if self._flush_handle:
            self._flush_handle.cancel()
        self._flush_handle = loop.call_later(
            5, lambda: asyncio.ensure_future(self.client.flush()))

    def on_chain_start(self, serialized: dict, inputs: dict, *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> None:
        span_id = self.client.start_span("chain", int(
            time.time() * 1000), self._parent_span_id(parent_run_id))
        self._span_by_run_id[str(run_id)] = span_id

    def on_chain_end(self, outputs: dict, *, run_id: UUID, **kwargs: Any) -> None:
        span_id = self._span_by_run_id.get(str(run_id))
        if span_id:
            self.client.end_span(span_id, "ok")
        self._schedule_flush()

    def on_chain_error(self, error: BaseException, *, run_id: UUID, **kwargs: Any) -> None:
        span_id = self._span_by_run_id.get(str(run_id))
        if span_id:
            self.client.end_span(span_id, "error")
        self._schedule_flush()

    def on_tool_start(self, serialized: dict, input_str: str, *, run_id: UUID, **kwargs: Any) -> None:
        self._tool_runs[str(run_id)] = (serialized.get(
            "name", "unknown_tool"), input_str, int(time.time() * 1000))

    def on_tool_end(self, output: Any, *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> None:
        tool_name, tool_input, started_at = self._tool_runs.pop(
            str(run_id), ("unknown_tool", None, int(time.time() * 1000)))
        self.client.record_tool_call(
            tool_name, tool_input, "success", output, started_at, self._parent_span_id(parent_run_id))

    def on_tool_error(self, error: BaseException, *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> None:
        tool_name, tool_input, started_at = self._tool_runs.pop(
            str(run_id), ("unknown_tool", None, int(time.time() * 1000)))
        self.client.record_tool_call(tool_name, tool_input, "error", {"message": str(
            error)}, started_at, self._parent_span_id(parent_run_id))

    def on_llm_start(self, serialized: dict, prompts: list[str], *, run_id: UUID, **kwargs: Any) -> None:
        model_name = serialized.get("kwargs", {}).get(
            "model", serialized.get("name", "unknown_model"))
        self._llm_runs[str(run_id)] = (model_name, int(time.time() * 1000))

    def on_llm_end(self, response: Any, *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> None:
        model_name, started_at = self._llm_runs.pop(
            str(run_id), ("unknown_model", int(time.time() * 1000)))
        try:
            text = response.generations[0][0].text
        except (AttributeError, IndexError):
            text = ""
        self.client.record_model_call(model_name, text, "success", started_at, parent_span_id=self._parent_span_id(parent_run_id))

    def on_llm_error(self, error: BaseException, *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> None:
        model_name, started_at = self._llm_runs.pop(str(run_id), ("unknown_model", int(time.time() * 1000)))
        self.client.record_model_call(model_name, str(error), "error", started_at, parent_span_id=self._parent_span_id(parent_run_id))

    def on_retriever_start(self, serialized: dict, query: str, *, run_id: UUID, **kwargs: Any) -> None:
        self._tool_runs[f"retriever:{run_id}"] = (
            "__retriever__", query, int(time.time() * 1000))

    def on_retriever_end(self, documents: list, *, run_id: UUID, parent_run_id: Optional[UUID] = None, **kwargs: Any) -> None:
        _, query, started_at = self._tool_runs.pop(f"retriever:{run_id}", ("__retriever__", "", int(time.time() * 1000)))
        scores = [d.metadata.get("score") for d in documents if getattr(d, "metadata", None) and isinstance(d.metadata.get("score"), (int, float))]
        span_id = self.client.start_span("retrieval", started_at, self._parent_span_id(parent_run_id))

        self.client.tag_span(span_id, "modulus.retrieval.query", query)
        self.client.tag_span(
            span_id, "modulus.retrieval.result_count", len(documents))
        if scores:
            self.client.tag_span(span_id, "modulus.retrieval.top_score", max(scores))
        self.client.end_span(span_id, "ok")
