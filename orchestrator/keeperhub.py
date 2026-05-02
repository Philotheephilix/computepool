"""KeeperHub MCP client.

KH does not expose a stable public REST endpoint for triggering Manual workflow
executions; the dashboard and the MCP server share an internal JSON-RPC path at
``/mcp``. This client speaks that JSON-RPC protocol so the orchestrator can
trigger workflows and poll execution status with the same API key it uses for
other KH operations.
"""
from __future__ import annotations

import json
from typing import Any

import httpx


class KeeperHubError(Exception):
    def __init__(self, code: str, http_status: int, body: Any = None):
        self.code = code
        self.http_status = http_status
        self.body = body
        super().__init__(f"[{code} http={http_status}] {body}")


class KeeperHubClient:
    """Async JSON-RPC client over KeeperHub's /mcp endpoint."""

    def __init__(self, api_key: str, base_url: str = "https://app.keeperhub.com",
                 timeout: float = 30.0):
        self._http = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            timeout=timeout,
        )
        self._session_id: str | None = None
        self._next_id = 0

    async def aclose(self):
        await self._http.aclose()

    def _new_id(self) -> int:
        self._next_id += 1
        return self._next_id

    async def _ensure_session(self) -> str:
        if self._session_id is not None:
            return self._session_id
        body = {
            "jsonrpc": "2.0",
            "id": self._new_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "discom-orchestrator", "version": "0.1"},
            },
        }
        r = await self._http.post("/mcp", json=body)
        if r.status_code >= 400:
            raise KeeperHubError("KH_MCP_INIT", r.status_code, r.text)
        sid = r.headers.get("mcp-session-id")
        if not sid:
            raise KeeperHubError("KH_MCP_INIT", r.status_code, "missing mcp-session-id header")
        self._session_id = sid
        return sid

    async def _rpc(self, method: str, params: dict) -> Any:
        sid = await self._ensure_session()
        body = {
            "jsonrpc": "2.0",
            "id": self._new_id(),
            "method": method,
            "params": params,
        }
        r = await self._http.post("/mcp", json=body, headers={"mcp-session-id": sid})
        if r.status_code >= 400:
            raise KeeperHubError("KH_MCP_HTTP", r.status_code, r.text)
        ctype = r.headers.get("content-type", "")
        if "text/event-stream" in ctype:
            payload = _parse_sse_first_data(r.text)
        else:
            payload = r.json()
        if "error" in payload:
            raise KeeperHubError("KH_MCP_RPC", r.status_code, payload["error"])
        return payload.get("result")

    async def _tool_call(self, tool: str, arguments: dict) -> dict:
        result = await self._rpc("tools/call", {"name": tool, "arguments": arguments})
        if not isinstance(result, dict):
            raise KeeperHubError("KH_MCP_SHAPE", 0, result)
        if result.get("isError"):
            raise KeeperHubError("KH_MCP_TOOL_ERROR", 0, result)
        content = result.get("content") or []
        for entry in content:
            if entry.get("type") == "text":
                text = entry.get("text", "")
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return {"raw": text}
        return {}

    async def execute_workflow(self, workflow_id: str, inputs: dict) -> dict:
        return await self._tool_call("execute_workflow", {
            "workflowId": workflow_id,
            "input": inputs,
        })

    async def get_execution(self, execution_id: str) -> dict:
        return await self._tool_call("get_execution_status", {
            "executionId": execution_id,
        })


def _parse_sse_first_data(text: str) -> dict:
    """KH may return JSON-RPC responses wrapped in SSE frames.

    Pull the first ``data:`` line and JSON-decode it. Returns ``{}`` if no
    ``data:`` line is present (caller will surface a shape error).
    """
    for line in text.splitlines():
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload:
                try:
                    return json.loads(payload)
                except json.JSONDecodeError:
                    return {}
    return {}


class WorkflowInputs:
    @staticmethod
    def coalition_form(*, session_id: str, coalition_address: str,
                       participants: list[str], terms_hash: str,
                       deadline_unix: int, stake_token: str, stake_per_party: str,
                       callback_url: str) -> dict:
        return {
            "session_id": session_id,
            "coalition_address": coalition_address,
            "participants": participants,
            "terms_hash": terms_hash,
            "deadline_unix": str(deadline_unix),
            "stake_token": stake_token,
            "stake_per_party": stake_per_party,
            "callback_url": callback_url,
        }

    @staticmethod
    def stream_start(*, session_id: str, super_token: str, pool_address: str,
                     sender: str, flow_rate_wei_per_sec: str,
                     callback_url: str) -> dict:
        return {
            "session_id": session_id,
            "super_token": super_token,
            "pool_address": pool_address,
            "sender": sender,
            "flow_rate_wei_per_sec": flow_rate_wei_per_sec,
            "callback_url": callback_url,
        }

    @staticmethod
    def stream_stop(*, session_id: str, super_token: str, pool_address: str,
                    sender: str, callback_url: str) -> dict:
        return {
            "session_id": session_id,
            "super_token": super_token,
            "pool_address": pool_address,
            "sender": sender,
            "callback_url": callback_url,
        }
