"""Bearer-token → wallet-address dependency for the OpenAI compatibility shim.

Two modes:
- CP_OPENAI_AUTH_DEV_PASSTHROUGH=1 : the bearer body itself is the caller wallet (must
  be a valid 0x-prefixed 20-byte hex address). Useful for local dev and CI.
- otherwise : look up `users.find_one({"openai_tokens": <token>})` and return its
  `wallet_address`.
"""
import os
import re

from fastapi import Header, HTTPException

from orchestrator.db import get_db

# Module-level db reference; tests patch this name directly via
# `patch("orchestrator.api.openai_auth.db", fake_db)`.
# In production it is None and get_db() is called at request time.
db = None

_ADDR_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


async def get_caller_wallet(authorization: str = Header("")) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()

    if os.environ.get("CP_OPENAI_AUTH_DEV_PASSTHROUGH") == "1":
        if not _ADDR_RE.match(token):
            raise HTTPException(
                status_code=401,
                detail="dev-passthrough requires a 0x-prefixed wallet address",
            )
        return token

    _db = db or get_db()
    user = await _db.users.find_one({"openai_tokens": token})
    if not user or not user.get("wallet_address"):
        raise HTTPException(status_code=401, detail="unknown bearer token")
    return user["wallet_address"]
