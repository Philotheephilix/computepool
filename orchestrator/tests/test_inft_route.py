"""Tests for PoolINFT authorization gate in POST /pools/{name}/infer."""
import base64
import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _valid_payment_header() -> str:
    payment = {
        "x402Version": 1,
        "scheme": "exact",
        "network": "0g-galileo",
        "payload": {
            "signature": "0xsig",
            "authorization": {
                "from": "0xa",
                "to": "0xb",
                "value": "1000",
                "validAfter": "0",
                "validBefore": "9",
                "nonce": "0x" + "00" * 32,
            },
        },
    }
    return base64.b64encode(json.dumps(payment).encode()).decode()


def _build_app(economics, run_inference, *, inft_client=None):
    """Build a minimal FastAPI app with the infer router wired in.

    If ``inft_client`` is provided it is attached to ``app.state.inft_client``.
    """
    from orchestrator.api.infer import build_router
    from orchestrator.auth import get_current_user

    app = FastAPI()
    app.include_router(build_router(economics=economics, run_inference=run_inference))
    app.dependency_overrides[get_current_user] = lambda: {"username": "test"}
    if inft_client is not None:
        app.state.inft_client = inft_client
    return app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_inft_client():
    """A mock INFTClient with an async ``is_authorized`` method."""
    client = AsyncMock()
    client.is_authorized = AsyncMock(return_value=True)
    return client


@pytest.fixture
def pool_with_inft_token_id():
    """Pool doc that carries an ``inft_token_id``."""
    return {
        "_id": "p42",
        "name": "demo",
        "model_name": "m",
        "state": "ready",
        "inft_token_id": 42,
    }


@pytest.fixture
def pool_without_inft_token_id():
    """Pool doc with no ``inft_token_id`` (legacy / unmigrated)."""
    return {
        "_id": "p99",
        "name": "demo",
        "model_name": "m",
        "state": "ready",
        "inft_token_id": None,
    }


# ---------------------------------------------------------------------------
# Happy path: wallet IS authorized
# ---------------------------------------------------------------------------

def test_inft_authorized_wallet_passes(_orchestrator_env, mock_inft_client, pool_with_inft_token_id):
    """When is_authorized returns True the request proceeds (200)."""
    mock_inft_client.is_authorized = AsyncMock(return_value=True)

    economics = AsyncMock()
    economics.on_payment_received = AsyncMock()
    economics.on_inference_complete = AsyncMock()
    economics.mark_settled = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "tokens"})

    app = _build_app(economics, run_inference, inft_client=mock_inft_client)
    client = TestClient(app)

    header = _valid_payment_header()
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_with_inft_token_id)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": True, "payer": "0xa"})), \
         patch("orchestrator.api.infer.settle_via_facilitator",
               AsyncMock(return_value={"success": True, "transaction": "0xtx",
                                        "network": "0g-galileo", "payer": "0xa"})):
        r = client.post(
            "/pools/demo/infer",
            json={"prompt": "hi", "max_tokens": 10},
            headers={
                "X-PAYMENT": header,
                "X-Wallet-Address": "0xCAFEBABECAFEBABECAFEBABECAFEBABECAFEBABE",
            },
        )
    assert r.status_code == 200
    mock_inft_client.is_authorized.assert_awaited_once_with(
        42, "0xCAFEBABECAFEBABECAFEBABECAFEBABECAFEBABE"
    )


# ---------------------------------------------------------------------------
# Sad path: wallet is NOT authorized → 403
# ---------------------------------------------------------------------------

def test_inft_unauthorized_wallet_returns_403(_orchestrator_env, mock_inft_client, pool_with_inft_token_id):
    """When is_authorized returns False the route must return 403."""
    mock_inft_client.is_authorized = AsyncMock(return_value=False)

    economics = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "tokens"})

    app = _build_app(economics, run_inference, inft_client=mock_inft_client)
    client = TestClient(app)

    header = _valid_payment_header()
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_with_inft_token_id)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": True, "payer": "0xa"})):
        r = client.post(
            "/pools/demo/infer",
            json={"prompt": "hi", "max_tokens": 10},
            headers={
                "X-PAYMENT": header,
                "X-Wallet-Address": "0xCAFEBABECAFEBABECAFEBABECAFEBABECAFEBABE",
            },
        )
    assert r.status_code == 403
    body = r.json()
    assert "not authorized on INFT" in body.get("detail", "")


# ---------------------------------------------------------------------------
# INFT pool but missing wallet header → 403
# ---------------------------------------------------------------------------

def test_inft_missing_wallet_header_returns_403(_orchestrator_env, mock_inft_client, pool_with_inft_token_id):
    """Pool has INFT token but caller sends no X-Wallet-Address → 403."""
    economics = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "tokens"})

    app = _build_app(economics, run_inference, inft_client=mock_inft_client)
    client = TestClient(app)

    header = _valid_payment_header()
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_with_inft_token_id)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": True, "payer": "0xa"})):
        r = client.post(
            "/pools/demo/infer",
            json={"prompt": "hi", "max_tokens": 10},
            headers={"X-PAYMENT": header},  # no X-Wallet-Address
        )
    assert r.status_code == 403
    assert "missing X-Wallet-Address" in r.json().get("detail", "")
    # is_authorized must NOT be called when the header is absent
    mock_inft_client.is_authorized.assert_not_awaited()


# ---------------------------------------------------------------------------
# Legacy pool (no inft_token_id) → INFT check is skipped entirely
# ---------------------------------------------------------------------------

def test_legacy_pool_skips_inft_check(_orchestrator_env, mock_inft_client, pool_without_inft_token_id):
    """Pools without inft_token_id must not call is_authorized at all."""
    economics = AsyncMock()
    economics.on_payment_received = AsyncMock()
    economics.on_inference_complete = AsyncMock()
    economics.mark_settled = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "tokens"})

    app = _build_app(economics, run_inference, inft_client=mock_inft_client)
    client = TestClient(app)

    header = _valid_payment_header()
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_without_inft_token_id)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": True, "payer": "0xa"})), \
         patch("orchestrator.api.infer.settle_via_facilitator",
               AsyncMock(return_value={"success": True, "transaction": "0xtx",
                                        "network": "0g-galileo", "payer": "0xa"})):
        r = client.post(
            "/pools/demo/infer",
            json={"prompt": "hi", "max_tokens": 10},
            headers={"X-PAYMENT": header},
        )
    assert r.status_code == 200
    # The INFT client must never be consulted for a legacy pool
    mock_inft_client.is_authorized.assert_not_awaited()


# ---------------------------------------------------------------------------
# No inft_client wired (legacy fallback) → request allowed, warning emitted
# ---------------------------------------------------------------------------

def test_no_inft_client_wired_allows_request(_orchestrator_env, pool_with_inft_token_id):
    """When app.state has no inft_client the gate is inactive (legacy fallback)."""
    import orchestrator.api.infer as infer_module

    # Reset the warn-once flag so we can observe the warning
    infer_module._inft_warn_once = False

    economics = AsyncMock()
    economics.on_payment_received = AsyncMock()
    economics.on_inference_complete = AsyncMock()
    economics.mark_settled = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "tokens"})

    # Build app WITHOUT injecting inft_client
    app = _build_app(economics, run_inference, inft_client=None)
    client = TestClient(app)

    header = _valid_payment_header()
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_with_inft_token_id)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": True, "payer": "0xa"})), \
         patch("orchestrator.api.infer.settle_via_facilitator",
               AsyncMock(return_value={"success": True, "transaction": "0xtx",
                                        "network": "0g-galileo", "payer": "0xa"})):
        r = client.post(
            "/pools/demo/infer",
            json={"prompt": "hi", "max_tokens": 10},
            headers={"X-PAYMENT": header},
        )
    # Gate is inactive → request passes through
    assert r.status_code == 200
    # Warn-once flag should now be set
    assert infer_module._inft_warn_once is True
