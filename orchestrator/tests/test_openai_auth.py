import os
import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, patch

from orchestrator.api.openai_auth import get_caller_wallet


@pytest.mark.asyncio
async def test_dev_passthrough_returns_bearer_as_wallet(monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    addr = "0x" + "ab" * 20
    out = await get_caller_wallet(authorization=f"Bearer {addr}")
    assert out.lower() == addr.lower()


@pytest.mark.asyncio
async def test_dev_passthrough_rejects_non_address(monkeypatch):
    monkeypatch.setenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", "1")
    with pytest.raises(HTTPException) as ei:
        await get_caller_wallet(authorization="Bearer not-an-address")
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_bearer_raises_401(monkeypatch):
    monkeypatch.delenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", raising=False)
    with pytest.raises(HTTPException) as ei:
        await get_caller_wallet(authorization="")
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_lookup_mode_finds_user(monkeypatch):
    monkeypatch.delenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", raising=False)
    fake_db = AsyncMock()
    fake_db.users.find_one = AsyncMock(return_value={"wallet_address": "0x" + "cd" * 20})
    with patch("orchestrator.api.openai_auth.db", fake_db):
        out = await get_caller_wallet(authorization="Bearer cp_secret")
    assert out == "0x" + "cd" * 20
    fake_db.users.find_one.assert_awaited_once_with({"openai_tokens": "cp_secret"})


@pytest.mark.asyncio
async def test_lookup_mode_unknown_token(monkeypatch):
    monkeypatch.delenv("CP_OPENAI_AUTH_DEV_PASSTHROUGH", raising=False)
    fake_db = AsyncMock()
    fake_db.users.find_one = AsyncMock(return_value=None)
    with patch("orchestrator.api.openai_auth.db", fake_db):
        with pytest.raises(HTTPException) as ei:
            await get_caller_wallet(authorization="Bearer unknown")
    assert ei.value.status_code == 401
