import hashlib
import hmac
import json
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient


def _sig(secret, body):
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_webhook_dispatch(_orchestrator_env):
    from orchestrator.settings import get_settings
    from orchestrator.webhooks import build_router

    get_settings.cache_clear()
    economics = AsyncMock()
    app = FastAPI()
    app.include_router(build_router(economics))
    client = TestClient(app)

    body = json.dumps(
        {
            "event": "coalition_proposed",
            "session_id": "c1",
            "onchain_id": 7,
            "tx_hash": "0xab",
        }
    ).encode()
    r = client.post(
        "/webhooks/keeperhub",
        content=body,
        headers={
            "X-Keeperhub-Signature": _sig("whsec_test", body),
            "content-type": "application/json",
        },
    )
    assert r.status_code == 200
    economics.on_coalition_proposed.assert_awaited_once()


def test_webhook_rejects_bad_signature(_orchestrator_env):
    from orchestrator.settings import get_settings
    from orchestrator.webhooks import build_router

    get_settings.cache_clear()
    app = FastAPI()
    app.include_router(build_router(AsyncMock()))
    client = TestClient(app)

    body = b'{"event":"coalition_proposed"}'
    r = client.post(
        "/webhooks/keeperhub",
        content=body,
        headers={
            "X-Keeperhub-Signature": "deadbeef",
            "content-type": "application/json",
        },
    )
    assert r.status_code == 401


def test_webhook_ignores_unknown_event(_orchestrator_env):
    from orchestrator.settings import get_settings
    from orchestrator.webhooks import build_router

    get_settings.cache_clear()
    app = FastAPI()
    app.include_router(build_router(AsyncMock()))
    client = TestClient(app)

    body = json.dumps({"event": "unknown_thing"}).encode()
    r = client.post(
        "/webhooks/keeperhub",
        content=body,
        headers={
            "X-Keeperhub-Signature": _sig("whsec_test", body),
            "content-type": "application/json",
        },
    )
    assert r.status_code == 200
    assert r.json()["ignored"] is True
