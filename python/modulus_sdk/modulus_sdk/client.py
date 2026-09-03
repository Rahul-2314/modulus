import time
import uuid
from typing import Any, Optional
import httpx


class ModulusClient:
    def __init__(self, api_key: str, agent_name: str, endpoint: str = "https://ingest.modulus.dev",
                 framework: str = "custom", commit_sha: Optional[str] = None, known_tools: Optional[list[str]] = None):
        self.api_key = api_key
        self.agent_name = agent_name
        self.endpoint = endpoint
        self.framework = framework
        self.commit_sha = commit_sha
        self.known_tools = known_tools
        self.trace_id = uuid.uuid4().hex
        self._spans: list[dict[str, Any]] = []

    def _new_span_id(self) -> str:
        return uuid.uuid4().hex[:16]

    def start_span(self, name: str, started_at_ms: int, parent_span_id: Optional[str] = None) -> str:
        span_id = self._new_span_id()
        self._spans.append({
            "traceId": self.trace_id, "spanId": span_id, "parentSpanId": parent_span_id,
            "name": name, "startTimeUnixNano": str(started_at_ms * 1_000_000),
            "status": "unset", "attributes": {},
        })
        return span_id

    # tag span
    def tag_span(self, span_id: str, key: str, value: Any):
        for span in self._spans:
            if span["spanId"] == span_id:
                span["attributes"][key] = value
                return

    def end_span(self, span_id: str, status: str = "ok"):
        for span in self._spans:
            if span["spanId"] == span_id:
                span["endTimeUnixNano"] = str(
                    int(time.time() * 1000) * 1_000_000)
                span["status"] = status
                return

    def record_tool_call(self, tool_name: str, arguments: Any, status: str, response: Any,
                         started_at_ms: int, parent_span_id: Optional[str] = None):
        self._spans.append({
            "traceId": self.trace_id, "spanId": self._new_span_id(), "parentSpanId": parent_span_id,
            "name": f"tool.{tool_name}", "startTimeUnixNano": str(started_at_ms * 1_000_000),
            "endTimeUnixNano": str(int(time.time() * 1000) * 1_000_000),
            "status": "error" if status == "error" else "ok",
            "attributes": {"modulus.tool.name": tool_name, "modulus.tool.arguments": arguments, "modulus.tool.response": response},
        })

    def record_model_call(self, model_name: str, output: str, status: str, started_at_ms: int,
                          cost_cents: Optional[float] = None, parent_span_id: Optional[str] = None):
        attributes: dict[str, Any] = {
            "modulus.model.name": model_name, "modulus.model.output": output}
        if cost_cents is not None:
            attributes["modulus.model.cost_cents"] = cost_cents
        self._spans.append({
            "traceId": self.trace_id, "spanId": self._new_span_id(), "parentSpanId": parent_span_id,
            "name": f"model.{model_name}", "startTimeUnixNano": str(started_at_ms * 1_000_000),
            "endTimeUnixNano": str(int(time.time() * 1000) * 1_000_000),
            "status": "error" if status == "error" else "ok",
            "attributes": attributes,
        })

    async def flush(self):
        if not self._spans:
            return
        batch, self._spans = self._spans, []

        resource_attributes: dict[str, Any] = {
            "modulus.agent.name": self.agent_name, "modulus.agent.framework": self.framework}
        if self.commit_sha:
            resource_attributes["modulus.git.commit_sha"] = self.commit_sha
        if self.known_tools:
            resource_attributes["modulus.agent.tools"] = self.known_tools

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{self.endpoint}/api/ingest/traces",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={"resourceAttributes": resource_attributes, "spans": batch},
                )
        except Exception:
            pass  # telemetry must never break the agent — same rule as the TS SDK

