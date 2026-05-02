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
        "KH_WORKFLOW_STREAM_START": "wf_start",
        "KH_WORKFLOW_STREAM_STOP": "wf_stop",
        "KH_WORKFLOW_HANDLE_BREACH": "wf_breach",
        "SEPOLIA_RPC_URL": "https://example/rpc",
        "USDC_ADDRESS": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        "USDCX_ADDRESS": "0xb598E6C621618a9f63788816ffb50Ee2862D443B",
        "COALITION_ADDRESS": "0x000000000000000000000000000000000000C0A1",
        "ORCHESTRATOR_WALLET_ADDRESS": "0x000000000000000000000000000000000000B0B0",
        "PUBLIC_URL": "http://localhost:8000",
        "X402_FACILITATOR_URL": "http://localhost:4021",
    }
    for k, v in defaults.items():
        monkeypatch.setenv(k, v)
