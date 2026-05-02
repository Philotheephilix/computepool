"""OpenAI-compatible request/response shapes for ComputePool.

Only the schema lives here for now. Routes (`/v1/models`, `/v1/chat/completions`)
land in subsequent tasks.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Route builder
# ---------------------------------------------------------------------------
# TODO(integration): mount build_router(db=get_db(), inft_client=app.state.inft_client) once A13 wires the client


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatCompletionsRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False
    temperature: float = 0.7
    max_tokens: int = Field(default=256, gt=0, le=4096)
    top_p: Optional[float] = None


class ChatCompletionsChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: Literal["stop", "length"]


class ChatCompletionsUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionsResponse(BaseModel):
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionsChoice]
    usage: ChatCompletionsUsage


# ---------------------------------------------------------------------------
# Router factory
# ---------------------------------------------------------------------------

from time import time  # noqa: E402

from fastapi import APIRouter, Depends  # noqa: E402

from orchestrator.api.openai_auth import get_caller_wallet  # noqa: E402


def build_router(*, db, inft_client: Optional[object] = None) -> APIRouter:
    """Build the OpenAI-compatibility router. `db` is a Motor database; `inft_client` is
    an optional INFTClient — when None, INFT-guarded pools pass through unchecked
    (legacy behaviour preserved during the migration window).
    """
    r = APIRouter(prefix="/v1")

    @r.get("/models")
    async def list_models(caller_wallet: str = Depends(get_caller_wallet)):
        out = []
        cursor = db.pools.find({"state": "loaded"})
        async for p in cursor:
            tid = p.get("inft_token_id")
            if tid is not None and inft_client is not None:
                ok = await inft_client.is_authorized(token_id=tid, user=caller_wallet)
                if not ok:
                    continue
            out.append({
                "id": p["name"],
                "object": "model",
                "created": int(time()),
                "owned_by": "computepool",
            })
        return {"object": "list", "data": out}

    return r
