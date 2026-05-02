import json
import pytest
from pytest_httpx import HTTPXMock
from orchestrator.keeperhub import KeeperHubClient, KeeperHubError, WorkflowInputs


def _add_init(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://app.keeperhub.com/mcp",
        method="POST",
        match_json={
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "discom-orchestrator", "version": "0.1"},
            },
        },
        headers={"mcp-session-id": "sid_test"},
        json={
            "jsonrpc": "2.0", "id": 1,
            "result": {"protocolVersion": "2025-06-18", "capabilities": {}},
        },
    )


@pytest.mark.asyncio
async def test_execute_workflow_success(httpx_mock: HTTPXMock):
    _add_init(httpx_mock)
    httpx_mock.add_response(
        url="https://app.keeperhub.com/mcp",
        method="POST",
        json={
            "jsonrpc": "2.0", "id": 2,
            "result": {
                "content": [{
                    "type": "text",
                    "text": json.dumps({"executionId": "exec_1", "status": "running"}),
                }],
            },
        },
    )
    kh = KeeperHubClient(api_key="kh_test", base_url="https://app.keeperhub.com")
    out = await kh.execute_workflow("wf_xxx", inputs={"foo": "bar"})
    assert out["executionId"] == "exec_1"
    await kh.aclose()


@pytest.mark.asyncio
async def test_execute_workflow_propagates_rpc_error(httpx_mock: HTTPXMock):
    _add_init(httpx_mock)
    httpx_mock.add_response(
        url="https://app.keeperhub.com/mcp",
        method="POST",
        json={
            "jsonrpc": "2.0", "id": 2,
            "error": {"code": -32600, "message": "bad input"},
        },
    )
    kh = KeeperHubClient(api_key="kh_test", base_url="https://app.keeperhub.com")
    with pytest.raises(KeeperHubError) as ei:
        await kh.execute_workflow("wf_xxx", inputs={})
    assert ei.value.code == "KH_MCP_RPC"
    await kh.aclose()


def test_workflow_inputs_coalition_form_shape():
    out = WorkflowInputs.coalition_form(
        session_id="s1",
        coalition_address="0x" + "C0" * 20,
        participants=["0xa", "0xb"],
        terms_hash="0x" + "ab" * 32,
        deadline_unix=1000,
        stake_token="0xCC",
        stake_per_party="1000000",
        callback_url="https://x/cb",
    )
    assert out["session_id"] == "s1"
    assert out["coalition_address"].startswith("0x")
    assert out["participants"] == ["0xa", "0xb"]
    assert out["callback_url"] == "https://x/cb"
    assert out["deadline_unix"] == "1000"
