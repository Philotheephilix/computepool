import asyncio  # noqa: F401  (kept for explicit asyncio availability)
import pytest
import pytest_asyncio  # noqa: F401  (registers asyncio support)


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
    }
    for k, v in defaults.items():
        monkeypatch.setenv(k, v)
