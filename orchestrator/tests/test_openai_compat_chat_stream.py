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


def _make_app(*, pool, signer, stream_inference, run_inference=None, inft=None):
    app = FastAPI()
    fake_db = MagicMock()
    fake_db.pools.find = lambda *a, **kw: _Cursor([pool])
    async def find_one(_):
        return pool
    fake_db.pools.find_one = find_one

    if run_inference is None:
        async def run_inference(**kw):
            raise RuntimeError("non-streaming path must not be hit in this test")

    app.include_router(build_router(
        db=fake_db, inft_client=inft, signer=signer,
        run_inference=run_inference, stream_inference=stream_inference,
    ))
    return app


@pytest.fixture
def signer():
    return TEESigner.dev_from_key(b"\x55" * 32)


@pytest.fixture
def pool():
    return {"name": "p1", "model": "m", "state": "loaded", "inft_token_id": None}


@pytest.mark.asyncio
async def test_stream_emits_chunks_then_done_then_signature(signer, pool, monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")

    async def fake_stream(*, pool_name, prompt, max_tokens, temperature=0.7, **kw):
        for tok in ["hi", " back"]:
            yield {"token": tok}
        yield {"done": True, "tokens_in": 3, "tokens_out": 2}

    app = _make_app(pool=pool, signer=signer, stream_inference=fake_stream)
    addr = "0x" + "ab" * 20

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        async with c.stream(
            "POST", "/v1/chat/completions",
            json={"model": "p1", "messages": [{"role": "user", "content": "hi"}], "stream": True},
            headers={"Authorization": f"Bearer {addr}"},
        ) as r:
            assert r.status_code == 200
            assert r.headers["content-type"].startswith("text/event-stream")
            raw_lines = []
            async for line in r.aiter_lines():
                raw_lines.append(line)

    text = "\n".join(raw_lines)
    # Token chunks present
    assert '"content":"hi"' in text
    assert '"content":" back"' in text
    # finish_reason on the closing chunk
    assert '"finish_reason":"stop"' in text
    # DONE sentinel
    assert "data: [DONE]" in text
    # Trailing signature event
    assert "event: signature" in text

    # Extract the signature event payload and verify it recovers to the signer
    sig_line_idx = next(i for i, l in enumerate(raw_lines) if l == "event: signature")
    sig_data_line = raw_lines[sig_line_idx + 1]
    assert sig_data_line.startswith("data: ")
    sig_payload = json.loads(sig_data_line.removeprefix("data: "))
    expected_body = ("hi" + " back").encode()
    recovered = Account.recover_message(
        encode_defunct(text="cp:" + hashlib.sha256(expected_body).hexdigest()),
        signature=bytes.fromhex(sig_payload["sig"].removeprefix("0x")),
    )
    assert recovered.lower() == sig_payload["signer"].lower() == signer.address.lower()


@pytest.mark.asyncio
async def test_stream_404_for_unknown_model(signer, monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")

    async def fake_stream(**kw):
        if False: yield  # never produces
        return

    app = FastAPI()
    fake_db = MagicMock()
    fake_db.pools.find = lambda *a, **kw: _Cursor([])
    async def find_one(_):
        return None
    fake_db.pools.find_one = find_one
    async def fake_run(**kw):
        raise RuntimeError("must not be called")
    app.include_router(build_router(
        db=fake_db, inft_client=None, signer=signer,
        run_inference=fake_run, stream_inference=fake_stream,
    ))

    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post(
            "/v1/chat/completions",
            json={"model": "missing", "messages": [{"role": "user", "content": "hi"}], "stream": True},
            headers={"Authorization": f"Bearer {addr}"},
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_stream_503_when_stream_inference_not_configured(signer, pool, monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    async def fake_run(**kw):
        return {"output": "x", "tokens_in": 1, "tokens_out": 1, "hit_max": False}
    # stream_inference omitted → /v1/chat/completions with stream=True must 503
    app = FastAPI()
    fake_db = MagicMock()
    fake_db.pools.find = lambda *a, **kw: _Cursor([pool])
    async def find_one(_):
        return pool
    fake_db.pools.find_one = find_one
    app.include_router(build_router(
        db=fake_db, inft_client=None, signer=signer,
        run_inference=fake_run, stream_inference=None,
    ))
    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post(
            "/v1/chat/completions",
            json={"model": "p1", "messages": [{"role": "user", "content": "hi"}], "stream": True},
            headers={"Authorization": f"Bearer {addr}"},
        )
    assert r.status_code == 503
