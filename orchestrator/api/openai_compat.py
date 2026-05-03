"""OpenAI-compatible request/response shapes for ComputePool.

Only the schema lives here for now. Routes (`/v1/models`, `/v1/chat/completions`)
land in subsequent tasks.
"""
import uuid
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

from fastapi import APIRouter, Depends, HTTPException, Response  # noqa: E402

from orchestrator.api.openai_auth import get_caller_wallet  # noqa: E402


def build_router(
    *,
    db,
    inft_client: Optional[object] = None,
    signer=None,
    run_inference=None,
    stream_inference=None,
) -> APIRouter:
    """Build the OpenAI-compatibility router. `db` is a Motor database; `inft_client` is
    an optional INFTClient — when None, INFT-guarded pools pass through unchecked
    (legacy behaviour preserved during the migration window).

    `signer` is an optional TEESigner; `run_inference` is an optional async callable.
    Both must be provided together to enable the /v1/chat/completions route.
    """
    r = APIRouter(prefix="/v1")

    def _checksum(addr: str) -> str:
        # web3.py strict-validates address casing before ABI-encoding the call.
        # The bearer-token wallet may be lowercase; normalize before passing it on.
        from web3 import Web3
        return Web3.to_checksum_address(addr)

    @r.get("/models")
    async def list_models(caller_wallet: str = Depends(get_caller_wallet)):
        out = []
        cursor = db.pools.find({"loaded": True})
        async for p in cursor:
            tid = p.get("inft_token_id")
            if tid is not None and inft_client is not None:
                ok = await inft_client.is_authorized(token_id=tid, user=_checksum(caller_wallet))
                if not ok:
                    continue
            out.append({
                "id": p["name"],
                "object": "model",
                "created": int(time()),
                "owned_by": "computepool",
            })
        return {"object": "list", "data": out}

    def _flatten_messages(messages):
        return "\n".join(f"{m.role}: {m.content}" for m in messages)

    @r.post("/chat/completions")
    async def chat_completions(
        req: ChatCompletionsRequest,
        caller_wallet: str = Depends(get_caller_wallet),
    ):
        if req.stream:
            if stream_inference is None:
                raise HTTPException(status_code=503, detail="streaming inference not configured")
            # Resolve pool first so 404 happens before we open the stream
            pool = await db.pools.find_one({"name": req.model, "loaded": True})
            if pool is None:
                pool = await db.pools.find_one({"model": req.model, "loaded": True})
            if pool is None:
                raise HTTPException(status_code=404, detail=f"no loaded pool for model={req.model}")
            tid = pool.get("inft_token_id")
            if tid is not None and inft_client is not None:
                ok = await inft_client.is_authorized(token_id=tid, user=_checksum(caller_wallet))
                if not ok:
                    raise HTTPException(status_code=403, detail="caller not authorized on INFT")

            async def gen():
                import json as _json
                import uuid as _uuid
                chunk_id = f"chatcmpl-{_uuid.uuid4().hex[:24]}"
                collected = []
                async for ev in stream_inference(
                    pool_name=pool["name"],
                    prompt=_flatten_messages(req.messages),
                    max_tokens=req.max_tokens,
                    temperature=req.temperature,
                ):
                    if "token" in ev:
                        collected.append(ev["token"])
                        payload = {
                            "id": chunk_id,
                            "object": "chat.completion.chunk",
                            "model": req.model,
                            "choices": [{
                                "index": 0,
                                "delta": {"content": ev["token"]},
                                "finish_reason": None,
                            }],
                        }
                        yield f"data: {_json.dumps(payload, separators=(',', ':'))}\n\n"
                    elif ev.get("done"):
                        final_payload = {
                            "id": chunk_id,
                            "object": "chat.completion.chunk",
                            "model": req.model,
                            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                        }
                        yield f"data: {_json.dumps(final_payload, separators=(',', ':'))}\n\n"
                        yield "data: [DONE]\n\n"
                        sig = signer.sign("".join(collected).encode())
                        yield f"event: signature\ndata: {_json.dumps({'signer': signer.address, 'sig': '0x' + sig.hex()}, separators=(',', ':'))}\n\n"

            from fastapi.responses import StreamingResponse
            return StreamingResponse(gen(), media_type="text/event-stream")

        if signer is None or run_inference is None:
            raise HTTPException(status_code=503, detail="chat completions not configured")

        pool = await db.pools.find_one({"name": req.model, "loaded": True})
        if pool is None:
            pool = await db.pools.find_one({"model": req.model, "loaded": True})
        if pool is None:
            raise HTTPException(status_code=404, detail=f"no loaded pool for model={req.model}")

        tid = pool.get("inft_token_id")
        if tid is not None and inft_client is not None:
            ok = await inft_client.is_authorized(token_id=tid, user=_checksum(caller_wallet))
            if not ok:
                raise HTTPException(status_code=403, detail="caller not authorized on INFT")

        result = await run_inference(
            pool_name=pool["name"],
            prompt=_flatten_messages(req.messages),
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )

        body = ChatCompletionsResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:24]}",
            created=int(time()),
            model=req.model,
            choices=[ChatCompletionsChoice(
                message=ChatMessage(role="assistant", content=result["output"]),
                finish_reason="length" if result.get("hit_max") else "stop",
            )],
            usage=ChatCompletionsUsage(
                prompt_tokens=result["tokens_in"],
                completion_tokens=result["tokens_out"],
                total_tokens=result["tokens_in"] + result["tokens_out"],
            ),
        )
        body_bytes = body.model_dump_json().encode()
        sig = signer.sign(body_bytes)
        headers = {
            "X-Computepool-Signer": signer.address,
            "X-Computepool-Signature": "0x" + sig.hex(),
        }
        return Response(content=body_bytes, media_type="application/json", headers=headers)

    return r
