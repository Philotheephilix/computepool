import asyncio  # noqa: F401  (kept for explicit asyncio availability)
import pytest
import pytest_asyncio  # noqa: F401  (registers asyncio support)


@pytest.fixture
def mock_loaded_pool(_orchestrator_env):
    """A minimal loaded-pool dict plus a mock run_inference_stream callable.

    Returned dict has two keys:
      - "name": str  — the pool name to pass to helpers
      - "pool": dict — the raw pool document
      - "run_stream": async callable — mock that yields token/done events

    Usage in tests::

        async for ev in stream_pool_inference(
            pool_name=mock_loaded_pool["name"],
            prompt="hi",
            max_tokens=4,
            _pool=mock_loaded_pool["pool"],
            _run_stream=mock_loaded_pool["run_stream"],
        )
    """
    pool_doc = {
        "_id": "pool-test-1",
        "name": "test-pool",
        "model_name": "test-model",
        "state": "loaded",
    }

    async def _fake_stream(pool, body, request_id):
        max_tokens = body.get("max_tokens", 4)
        count = min(max_tokens, 3)
        for i in range(count):
            yield {"event": "token", "token": f"tok{i}"}
        yield {"event": "done", "tokens_in": 2, "tokens_out": count}

    return {
        "name": pool_doc["name"],
        "pool": pool_doc,
        "run_stream": _fake_stream,
    }


@pytest.fixture(autouse=True)
def _orchestrator_env(monkeypatch):
    """Default minimum env so Settings() instantiates."""
    defaults = {
        "MONGODB_URI": "mongodb://localhost:27017",
        "MONGODB_DB": "discom_test",
        "KEEPERHUB_API_KEY": "kh_test",
        "KEEPERHUB_BASE_URL": "https://api.keeperhub.com",
        "KEEPERHUB_WEBHOOK_SECRET": "whsec_test",
        "KH_WORKFLOW_COALITION_FORM": "wf_form",
        "KH_WORKFLOW_ACTIVATE_AND_POOL": "wf_activate",
        "KH_WORKFLOW_SET_MEMBER_UNITS": "wf_set_units",
        "KH_WORKFLOW_STREAM_START": "wf_start",
        "KH_WORKFLOW_STREAM_STOP": "wf_stop",
        "KH_WORKFLOW_HANDLE_BREACH": "wf_breach",
        "SEPOLIA_RPC_URL": "https://example/rpc",
        "USDC_ADDRESS": "0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189",
        "USDCX_ADDRESS": "0x0000000000000000000000000000000000000000",
        "COALITION_ADDRESS": "0x6647E81040a3E9BF658e107360c638c5DD04d1eF",
        "ORCHESTRATOR_WALLET_ADDRESS": "0x000000000000000000000000000000000000B0B0",
        "CFA_V1_FORWARDER": "0x0000000000000000000000000000000000000000",
        "GDA_V1_FORWARDER": "0x0000000000000000000000000000000000000000",
        "PUBLIC_URL": "http://localhost:8000",
        "X402_FACILITATOR_URL": "http://localhost:4021",
        "ORCHESTRATOR_PRIVATE_KEY": "0x" + "a" * 64,
    }
    for k, v in defaults.items():
        monkeypatch.setenv(k, v)
