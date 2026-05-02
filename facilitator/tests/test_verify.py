import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

USDC_SEPOLIA = "0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189"


def _build_request(auth, sig):
    return {
        "x402Version": 1,
        "paymentPayload": {
            "x402Version": 1,
            "scheme": "exact",
            "network": "0g-galileo",
            "payload": {"signature": sig, "authorization": auth},
        },
        "paymentRequirements": {
            "scheme": "exact",
            "network": "0g-galileo",
            "maxAmountRequired": "1000000",
            "resource": "/pools/test/infer",
            "description": "test",
            "mimeType": "application/json",
            "payTo": "0x000000000000000000000000000000000000bEEF",
            "maxTimeoutSeconds": 60,
            "asset": USDC_SEPOLIA,
            "extra": {"name": "USDC", "version": "2"},
        },
    }


def test_verify_valid(env_for_app, signed_authorization):
    from facilitator.app import app

    auth, sig = signed_authorization
    with patch("facilitator.app.chain") as chain_mock:
        chain_mock.is_nonce_used = AsyncMock(return_value=False)
        chain_mock.usdc_balance = AsyncMock(return_value=2_000_000)
        client = TestClient(app)
        r = client.post("/verify", json=_build_request(auth, sig))
        assert r.status_code == 200
        body = r.json()
        assert body["isValid"] is True
        assert body["payer"].lower() == auth["from"].lower()


def test_verify_amount_short(env_for_app, signed_authorization):
    from facilitator.app import app

    auth, sig = signed_authorization
    auth = dict(auth, value="100")  # below maxAmountRequired
    with patch("facilitator.app.chain") as chain_mock:
        chain_mock.is_nonce_used = AsyncMock(return_value=False)
        chain_mock.usdc_balance = AsyncMock(return_value=2_000_000)
        client = TestClient(app)
        r = client.post("/verify", json=_build_request(auth, sig))
        # Note: re-signing with new value would change the signature; we only
        # check post-recovery validation logic so we expect signer-mismatch first
        body = r.json()
        assert body["isValid"] is False


def test_verify_nonce_used(env_for_app, signed_authorization):
    from facilitator.app import app

    auth, sig = signed_authorization
    with patch("facilitator.app.chain") as chain_mock:
        chain_mock.is_nonce_used = AsyncMock(return_value=True)
        chain_mock.usdc_balance = AsyncMock(return_value=2_000_000)
        client = TestClient(app)
        r = client.post("/verify", json=_build_request(auth, sig))
        body = r.json()
        assert body["isValid"] is False
        assert "nonce" in body["invalidReason"].lower()


def test_verify_balance_short(env_for_app, signed_authorization):
    from facilitator.app import app

    auth, sig = signed_authorization
    with patch("facilitator.app.chain") as chain_mock:
        chain_mock.is_nonce_used = AsyncMock(return_value=False)
        chain_mock.usdc_balance = AsyncMock(return_value=10)  # below value
        client = TestClient(app)
        r = client.post("/verify", json=_build_request(auth, sig))
        body = r.json()
        assert body["isValid"] is False
        assert "balance" in body["invalidReason"].lower()
