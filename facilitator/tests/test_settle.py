from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

USDC_SEPOLIA = "0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189"


def _request(auth, sig):
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


def test_settle_success(env_for_app, signed_authorization):
    from facilitator.app import app
    auth, sig = signed_authorization

    with patch("facilitator.app.chain") as chain_mock:
        chain_mock.submit_transfer_with_authorization = AsyncMock(
            return_value={"tx_hash": "0xdead", "status": 1, "block_number": 12345}
        )
        client = TestClient(app)
        r = client.post("/settle", json=_request(auth, sig))
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["transaction"] == "0xdead"
        assert body["payer"].lower() == auth["from"].lower()


def test_settle_tx_failed(env_for_app, signed_authorization):
    from facilitator.app import app
    auth, sig = signed_authorization

    with patch("facilitator.app.chain") as chain_mock:
        chain_mock.submit_transfer_with_authorization = AsyncMock(
            return_value={"tx_hash": "0xdead", "status": 0, "block_number": 12345}
        )
        client = TestClient(app)
        r = client.post("/settle", json=_request(auth, sig))
        body = r.json()
        assert body["success"] is False
        assert body["transaction"] == "0xdead"
