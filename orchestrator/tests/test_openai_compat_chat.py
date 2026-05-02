import hashlib
import json

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from unittest.mock import MagicMock

from orchestrator.api.openai_compat import build_router
from orchestrator.tee.signer import TEESigner


class _Cursor:
    def __init__(self, items):
        self._items = list(items)
    def __aiter__(self):
        self._iter = iter(self._items)
        return self
    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


def _make_app(*, pools, signer, run_inference):
    app = FastAPI()
    fake_db = MagicMock()
    fake_db.pools.find = lambda *a, **kw: _Cursor(pools)
    async def find_one(filt):
        for p in pools:
            ok = True
            for k, v in filt.items():
                if p.get(k) != v:
                    ok = False; break
            if ok:
                return p
        return None
    fake_db.pools.find_one = find_one
    app.include_router(build_router(db=fake_db, inft_client=None, signer=signer, run_inference=run_inference))
    return app


@pytest.fixture
def signer():
    return TEESigner.dev_from_key(b"\x42" * 32)


@pytest.fixture
def loaded_pool():
    return {"name": "p1", "model": "Qwen/Qwen2.5-3B-Instruct", "state": "loaded", "inft_token_id": None}


@pytest.mark.asyncio
async def test_chat_completions_returns_signed_response(signer, loaded_pool, monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")

    async def fake_run(*, pool_name, prompt, max_tokens, temperature=0.7, **kw):
        return {"output": "hi back", "tokens_in": 5, "tokens_out": 2, "hit_max": False}

    app = _make_app(pools=[loaded_pool], signer=signer, run_inference=fake_run)
    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post(
            "/v1/chat/completions",
            json={"model": "p1", "messages": [{"role": "user", "content": "hi"}], "stream": False},
            headers={"Authorization": f"Bearer {addr}"},
        )

    assert r.status_code == 200
    body_bytes = r.content
    sig_hex = r.headers["X-Computepool-Signature"]
    signer_addr = r.headers["X-Computepool-Signer"]
    assert sig_hex.startswith("0x") and len(sig_hex) == 132  # 65 bytes hex + "0x"

    # Verify the signature recovers to the signer
    recovered = Account.recover_message(
        encode_defunct(text="cp:" + hashlib.sha256(body_bytes).hexdigest()),
        signature=bytes.fromhex(sig_hex.removeprefix("0x")),
    )
    assert recovered.lower() == signer_addr.lower() == signer.address.lower()

    body = json.loads(body_bytes)
    assert body["choices"][0]["message"]["content"] == "hi back"
    assert body["usage"]["prompt_tokens"] == 5
    assert body["usage"]["completion_tokens"] == 2
    assert body["choices"][0]["finish_reason"] == "stop"


@pytest.mark.asyncio
async def test_chat_completions_404_for_unknown_model(signer, monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    async def fake_run(*, pool_name, prompt, max_tokens, temperature=0.7, **kw):
        raise RuntimeError("should not be called")
    app = _make_app(pools=[], signer=signer, run_inference=fake_run)
    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post(
            "/v1/chat/completions",
            json={"model": "missing", "messages": [{"role": "user", "content": "hi"}]},
            headers={"Authorization": f"Bearer {addr}"},
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_chat_completions_403_when_inft_unauthorized(signer, monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    pool = {"name": "p1", "model": "x", "state": "loaded", "inft_token_id": 7}
    from unittest.mock import AsyncMock
    inft = AsyncMock()
    inft.is_authorized = AsyncMock(return_value=False)
    async def fake_run(**kw): raise RuntimeError("must not be called")

    app = FastAPI()
    fake_db = MagicMock()
    async def find_one(_):
        return pool
    fake_db.pools.find_one = find_one
    fake_db.pools.find = lambda *a, **kw: _Cursor([pool])
    app.include_router(build_router(db=fake_db, inft_client=inft, signer=signer, run_inference=fake_run))

    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post(
            "/v1/chat/completions",
            json={"model": "p1", "messages": [{"role": "user", "content": "hi"}]},
            headers={"Authorization": f"Bearer {addr}"},
        )
    assert r.status_code == 403
