from __future__ import annotations

import os
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


DEFAULT_URI = (
    "mongodb+srv://maintainer_philix:qwertyuiop@carbonpi.hiozz58.mongodb.net/"
    "?retryWrites=true&w=majority"
)
DEFAULT_DB = "computepool"


def get_uri() -> str:
    return os.environ.get("MONGODB_URI", DEFAULT_URI)


def get_db_name() -> str:
    return os.environ.get("MONGODB_DB", DEFAULT_DB)


_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def init_db(
    uri: Optional[str] = None,
    db_name: Optional[str] = None,
) -> AsyncIOMotorDatabase:
    global _client, _db
    uri = uri or get_uri()
    db_name = db_name or get_db_name()
    if _client is None:
        _client = AsyncIOMotorClient(uri)
    _db = _client[db_name]
    await ensure_indexes(_db)
    return _db


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db["users"].create_index("username", unique=True)
    await db["users"].create_index("api_key", unique=True)
    await db["nodes"].create_index("owner_username")
    await db["nodes"].create_index("pool_name")
    await db["nodes"].create_index([("owner_username", 1), ("node_id", 1)], unique=True)
    await db["pools"].create_index("owner_username")
    await db["pools"].create_index([("owner_username", 1), ("name", 1)], unique=True)


async def ensure_economic_indexes(db: AsyncIOMotorDatabase) -> None:
    """Idempotent: safe to call on every startup."""
    await db["coalitions"].create_index([("pool_id", 1)])
    await db["coalitions"].create_index([("onchain_id", 1)], sparse=True)
    await db["payment_pools"].create_index([("pool_id", 1)], unique=True)
    await db["payments"].create_index([("pool_id", 1), ("created_at", -1)])
    await db["payments"].create_index(
        [("inference_request_id", 1)], unique=True, sparse=True
    )


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database is not initialized; call init_db() first.")
    return _db


def users():
    return get_db()["users"]


def nodes():
    return get_db()["nodes"]


def pools():
    return get_db()["pools"]
