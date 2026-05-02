from __future__ import annotations

import ipaddress
import os
import re
from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


USERNAME_RE = re.compile(r"^[a-z0-9_-]{3,32}$")
POOLNAME_RE = re.compile(r"^[a-z0-9_-]{3,64}$")
NODEID_RE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
PEERID_RE = re.compile(r"^[0-9a-fA-F]{64}$")
HOST_RE = re.compile(r"^[A-Za-z0-9._-]+$")
WALLET_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")

ALLOW_PRIVATE_WORKER_URLS = os.environ.get("ALLOW_PRIVATE_WORKER_URLS", "1") == "1"


def _validate_worker_url(url: str) -> str:
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        raise ValueError("worker_url scheme must be http or https")
    if p.username or p.password:
        raise ValueError("worker_url must not contain userinfo")
    if not p.hostname:
        raise ValueError("worker_url must have a host")
    if not HOST_RE.match(p.hostname):
        raise ValueError("worker_url hostname has invalid characters")
    if p.port is not None and not (1 <= p.port <= 65535):
        raise ValueError("worker_url port out of range")
    if not ALLOW_PRIVATE_WORKER_URLS:
        try:
            ip = ipaddress.ip_address(p.hostname)
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast:
                raise ValueError("worker_url cannot point to a private/loopback IP")
        except ValueError as e:
            if "private" in str(e) or "loopback" in str(e):
                raise
    return url


def _validate_username(v: str) -> str:
    if not USERNAME_RE.match(v):
        raise ValueError("username must be 3-32 chars, [a-z0-9_-]")
    return v


def _validate_poolname(v: str) -> str:
    if not POOLNAME_RE.match(v):
        raise ValueError("pool name must be 3-64 chars, [a-z0-9_-]")
    return v


class RegisterRequest(BaseModel):
    username: str
    password: str = Field(min_length=6, max_length=128)

    @field_validator("username")
    @classmethod
    def _v_username(cls, v: str) -> str:
        return _validate_username(v)


class LoginRequest(BaseModel):
    username: str
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    username: str
    api_key: str


class MeResponse(BaseModel):
    username: str


class NodeRegisterRequest(BaseModel):
    node_id: str
    axl_peer_id: str
    axl_ipv6: str
    ip_address: str
    worker_url: str
    wallet_address: Optional[str] = None

    @field_validator("node_id")
    @classmethod
    def _v_node_id(cls, v: str) -> str:
        if not NODEID_RE.match(v):
            raise ValueError("node_id must be 1-64 chars, [A-Za-z0-9_.-]")
        return v

    @field_validator("axl_peer_id")
    @classmethod
    def _v_peer(cls, v: str) -> str:
        if not PEERID_RE.match(v):
            raise ValueError("axl_peer_id must be 64 hex chars")
        return v

    @field_validator("worker_url")
    @classmethod
    def _v_worker_url(cls, v: str) -> str:
        return _validate_worker_url(v)

    @field_validator("wallet_address")
    @classmethod
    def _v_wallet(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not WALLET_RE.match(v):
            raise ValueError("wallet_address must be 0x + 40 hex chars")
        return v


class NodeRegisterResponse(BaseModel):
    ok: bool
    owner: str


class Node(BaseModel):
    node_id: str
    owner_username: str
    ip_address: Optional[str] = None
    axl_peer_id: Optional[str] = None
    axl_ipv6: Optional[str] = None
    worker_url: Optional[str] = None
    pool_name: Optional[str] = None
    registered_at: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    status: str = "registered"
    role: Optional[str] = None
    layers: Optional[list[int]] = None
    model: Optional[str] = None


class PoolCreateRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _v_name(cls, v: str) -> str:
        return _validate_poolname(v)


class PoolAddNodesRequest(BaseModel):
    node_ids: list[str] = Field(min_length=1)

    @field_validator("node_ids")
    @classmethod
    def _v_each(cls, v: list[str]) -> list[str]:
        for nid in v:
            if not NODEID_RE.match(nid):
                raise ValueError(f"node_id {nid!r} must be 1-64 chars, [A-Za-z0-9_.-]")
        return v


class PoolInitializeRequest(BaseModel):
    model: str
    price_per_token_usdc: float = Field(ge=0.0, le=100.0)
    currency: Literal["USDC"] = "USDC"
    stake_amount_wei: Optional[str] = None
    deadline_unix: Optional[int] = None


class Assignment(BaseModel):
    node_id: str
    role: Literal["entry", "exit"]
    layers: list[int] = Field(min_length=2, max_length=2)


class Pool(BaseModel):
    name: str
    owner_username: str
    node_ids: list[str] = []
    model: Optional[str] = None
    price_per_token_usdc: Optional[float] = None
    currency: Literal["USDC"] = "USDC"
    initialized: bool = False
    loaded: bool = False
    assignments: Optional[list[Assignment]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    inft_token_id: int | None = None
    inft_metadata_uri: str | None = None


class InferRequest(BaseModel):
    prompt: str
    max_tokens: int = 64
    temperature: float = 0.0


class InferResponse(BaseModel):
    text: Optional[str] = None
    tokens: Optional[int] = None
    elapsed_s: Optional[float] = None
    tokens_per_sec: Optional[float] = None
    cost_usdc: float
    currency: Literal["USDC"] = "USDC"
    pool: str
    entry_node: str
    exit_node: str
    request_id: str
    timings: Optional[dict[str, Any]] = None


def node_to_response(doc: dict) -> dict:
    return {
        "node_id": doc.get("node_id"),
        "owner_username": doc.get("owner_username"),
        "ip_address": doc.get("ip_address"),
        "axl_peer_id": doc.get("axl_peer_id"),
        "axl_ipv6": doc.get("axl_ipv6"),
        "worker_url": doc.get("worker_url"),
        "pool_name": doc.get("pool_name"),
        "registered_at": doc.get("registered_at"),
        "last_seen": doc.get("last_seen"),
        "status": doc.get("status", "registered"),
        "role": doc.get("role"),
        "layers": doc.get("layers"),
        "model": doc.get("model"),
    }


def pool_to_response(doc: dict) -> dict:
    return {
        "name": doc.get("name"),
        "owner_username": doc.get("owner_username"),
        "node_ids": doc.get("node_ids", []),
        "model": doc.get("model"),
        "price_per_token_usdc": doc.get("price_per_token_usdc"),
        "currency": doc.get("currency", "USDC"),
        "initialized": doc.get("initialized", False),
        "loaded": doc.get("loaded", False),
        "assignments": doc.get("assignments"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "inft_token_id": doc.get("inft_token_id"),
        "inft_metadata_uri": doc.get("inft_metadata_uri"),
    }


class CoalitionState(str, Enum):
    PROPOSED = "proposed"
    ACTIVATING = "activating"
    ACTIVE = "active"
    DISSOLVED = "dissolved"
    EXPIRED = "expired"


class Coalition(BaseModel):
    id: str
    pool_id: str
    onchain_id: int | None = None
    terms_hash: str
    participants: list[str]
    signatures: dict[str, str] = Field(default_factory=dict)
    state: CoalitionState
    deadline: datetime
    created_at: datetime
    tx_hashes: dict[str, str] = Field(default_factory=dict)


class PaymentPoolState(str, Enum):
    INITIALIZING = "initializing"
    READY = "ready"
    STREAMING = "streaming"
    STOPPED = "stopped"


class PaymentPool(BaseModel):
    id: str
    pool_id: str
    superfluid_pool_address: str | None = None
    super_token: str
    member_units: dict[str, int] = Field(default_factory=dict)
    state: PaymentPoolState = PaymentPoolState.INITIALIZING
    current_flow_rate_wei_per_sec: str = "0"
    created_at: datetime


class PaymentState(str, Enum):
    VERIFIED = "verified"
    STREAMING = "streaming"
    STOPPED = "stopped"
    SETTLED = "settled"
    ORPHANED = "orphaned"


class Payment(BaseModel):
    id: str
    pool_id: str
    payer: str
    amount_usdc_micro: int
    amount_usdcx_wei: str
    flow_rate_wei_per_sec: str
    estimated_duration_s: float
    inference_request_id: str
    state: PaymentState
    created_at: datetime
    stream_open_tx: str | None = None
    stream_close_tx: str | None = None
    settle_tx: str | None = None
