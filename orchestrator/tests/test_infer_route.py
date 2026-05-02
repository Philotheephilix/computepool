import base64
import json
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import ANY, AsyncMock, patch


def _build_app(economics, run_inference):
    from orchestrator.api.infer import build_router
    from orchestrator.auth import get_current_user

    app = FastAPI()
    app.include_router(build_router(economics=economics, run_inference=run_inference))
    app.dependency_overrides[get_current_user] = lambda: {"username": "test"}
    return app


def test_infer_returns_402_without_payment(_orchestrator_env):
    economics = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "x"})
    app = _build_app(economics, run_inference)
    client = TestClient(app)

    pool_doc = {"_id": "p1", "name": "demo", "model_name": "m", "state": "ready"}
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_doc)):
        r = client.post("/pools/demo/infer", json={"prompt": "hi", "max_tokens": 10})
        assert r.status_code == 402
        body = r.json()
        assert body["accepts"][0]["scheme"] == "exact"
        assert body["error"]


def test_infer_runs_with_valid_payment(_orchestrator_env):
    economics = AsyncMock()
    economics.on_payment_received = AsyncMock()
    economics.on_inference_complete = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "tokens"})
    app = _build_app(economics, run_inference)
    client = TestClient(app)

    pool_doc = {"_id": "p1", "name": "demo", "model_name": "m", "state": "ready"}
    payment = {
        "x402Version": 1, "scheme": "exact", "network": "sepolia",
        "payload": {"signature": "0xsig", "authorization": {
            "from": "0xa", "to": "0xb", "value": "1000",
            "validAfter": "0", "validBefore": "9", "nonce": "0x" + "00"*32}},
    }
    header = base64.b64encode(json.dumps(payment).encode()).decode()
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_doc)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": True, "payer": "0xa"})), \
         patch("orchestrator.api.infer.settle_via_facilitator",
               AsyncMock(return_value={"success": True, "transaction": "0xtx", "network": "sepolia", "payer": "0xa"})):
        r = client.post("/pools/demo/infer",
                        json={"prompt": "hi", "max_tokens": 10},
                        headers={"X-PAYMENT": header})
        assert r.status_code == 200
        assert r.json()["output"] == "tokens"
        assert "X-PAYMENT-RESPONSE" in r.headers
        economics.on_payment_received.assert_awaited()
        economics.on_inference_complete.assert_awaited()


def test_infer_returns_402_on_invalid_payment(_orchestrator_env):
    economics = AsyncMock()
    run_inference = AsyncMock()
    app = _build_app(economics, run_inference)
    client = TestClient(app)

    pool_doc = {"_id": "p1", "name": "demo", "model_name": "m", "state": "ready"}
    payment = {"x402Version": 1, "scheme": "exact", "network": "sepolia",
               "payload": {"signature": "0xsig", "authorization": {
                   "from": "0xa", "to": "0xb", "value": "1000",
                   "validAfter": "0", "validBefore": "9", "nonce": "0x" + "00"*32}}}
    header = base64.b64encode(json.dumps(payment).encode()).decode()
    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_doc)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": False, "invalidReason": "balance insufficient"})):
        r = client.post("/pools/demo/infer",
                        json={"prompt": "hi", "max_tokens": 10},
                        headers={"X-PAYMENT": header})
        assert r.status_code == 402
        assert "balance" in r.json()["error"]


def test_infer_calls_mark_settled_on_success(_orchestrator_env):
    economics = AsyncMock()
    economics.on_payment_received = AsyncMock()
    economics.on_inference_complete = AsyncMock()
    economics.mark_settled = AsyncMock()
    run_inference = AsyncMock(return_value={"output": "x"})
    app = _build_app(economics, run_inference)
    client = TestClient(app)

    pool_doc = {"_id": "p1", "name": "demo", "model_name": "m", "state": "ready"}
    payment = {"x402Version": 1, "scheme": "exact", "network": "sepolia",
               "payload": {"signature": "0xsig", "authorization": {
                   "from": "0xa", "to": "0xb", "value": "1000",
                   "validAfter": "0", "validBefore": "9", "nonce": "0x" + "00"*32}}}
    header = base64.b64encode(json.dumps(payment).encode()).decode()

    with patch("orchestrator.api.infer._load_pool", AsyncMock(return_value=pool_doc)), \
         patch("orchestrator.api.infer.verify_via_facilitator",
               AsyncMock(return_value={"isValid": True, "payer": "0xa"})), \
         patch("orchestrator.api.infer.settle_via_facilitator",
               AsyncMock(return_value={"success": True, "transaction": "0xtx",
                                        "network": "sepolia", "payer": "0xa"})):
        r = client.post("/pools/demo/infer",
                        json={"prompt": "hi", "max_tokens": 10},
                        headers={"X-PAYMENT": header})
        assert r.status_code == 200
        economics.mark_settled.assert_awaited_with(
            inference_request_id=ANY, settle_tx="0xtx")
