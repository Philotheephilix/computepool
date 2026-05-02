import os
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock

from orchestrator.api.openai_compat import build_router


@pytest.fixture
def fake_pool():
    return {"name": "p1", "model": "Qwen/Qwen2.5-3B-Instruct", "state": "loaded", "inft_token_id": None}


def _make_app(*, pools, inft_client=None):
    """Build a tiny FastAPI app with build_router mounted, mocked db + optional inft client."""
    app = FastAPI()
    fake_db = MagicMock()
    # Motor-style cursor mock: db.pools.find(...) returns an async iterable
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
    fake_db.pools.find = lambda *a, **kw: _Cursor(pools)
    app.state.inft_client = inft_client
    app.include_router(build_router(db=fake_db, inft_client=inft_client))
    return app


@pytest.mark.asyncio
async def test_models_lists_loaded_pools_when_no_inft(fake_pool, monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    app = _make_app(pools=[fake_pool])
    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/v1/models", headers={"Authorization": f"Bearer {addr}"})
    assert r.status_code == 200
    body = r.json()
    assert body["object"] == "list"
    ids = [m["id"] for m in body["data"]]
    assert "p1" in ids


@pytest.mark.asyncio
async def test_models_filters_by_inft_authorization(monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    pool_a = {"name": "p1", "model": "x", "state": "loaded", "inft_token_id": 7}
    pool_b = {"name": "p2", "model": "y", "state": "loaded", "inft_token_id": 8}
    inft = AsyncMock()
    # caller authorized for token 7 only
    async def is_auth(*, token_id, user):
        return token_id == 7
    inft.is_authorized.side_effect = is_auth
    app = _make_app(pools=[pool_a, pool_b], inft_client=inft)
    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/v1/models", headers={"Authorization": f"Bearer {addr}"})
    assert r.status_code == 200
    ids = [m["id"] for m in r.json()["data"]]
    assert ids == ["p1"]


@pytest.mark.asyncio
async def test_models_includes_unguarded_pools_when_no_client(monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    pool_g = {"name": "guarded", "model": "x", "state": "loaded", "inft_token_id": 99}
    pool_u = {"name": "unguarded", "model": "y", "state": "loaded", "inft_token_id": None}
    app = _make_app(pools=[pool_g, pool_u], inft_client=None)
    addr = "0x" + "ab" * 20
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/v1/models", headers={"Authorization": f"Bearer {addr}"})
    assert r.status_code == 200
    ids = [m["id"] for m in r.json()["data"]]
    # Without client, guarded pools are passed through (legacy behaviour); both appear.
    assert set(ids) == {"guarded", "unguarded"}


@pytest.mark.asyncio
async def test_models_rejects_missing_bearer():
    app = _make_app(pools=[])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/v1/models")
    assert r.status_code in (401, 422)
