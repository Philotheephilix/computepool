import json
import logging
import uuid
from typing import Any, AsyncIterator, Awaitable, Callable, Dict
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from ..auth import get_current_user
from ..settings import get_settings
from ..x402 import (
    build_payment_requirements,
    parse_payment_header,
    verify_via_facilitator,
    settle_via_facilitator,
    build_payment_response_header,
)


logger = logging.getLogger("discom.infer")

_inft_warn_once = False


async def _check_inft_authorization(request: Request, pool: dict) -> None:
    """Raise HTTPException(403) if the pool has an INFT and the caller wallet isn't authorized.

    - Pools without ``inft_token_id`` (legacy / unmigrated) are passed through unchanged.
    - If no ``inft_client`` is wired on ``app.state`` the gate is inactive and a one-time
      warning is emitted; this keeps the route safe before Task A13 lands.
    """
    global _inft_warn_once
    token_id = pool.get("inft_token_id")
    if token_id is None:
        return  # legacy pool, no INFT check

    inft_client = getattr(request.app.state, "inft_client", None)
    if inft_client is None:
        if not _inft_warn_once:
            logging.warning("INFT client not wired; INFT auth gate inactive (Task A13 will wire it)")
            _inft_warn_once = True
        return

    caller_wallet = request.headers.get("X-Wallet-Address")
    if not caller_wallet:
        raise HTTPException(
            status_code=403,
            detail="caller not authorized on INFT (missing X-Wallet-Address header)",
        )

    authorized = await inft_client.is_authorized(token_id, caller_wallet)
    if not authorized:
        raise HTTPException(
            status_code=403,
            detail=f"caller wallet {caller_wallet!r} is not authorized on INFT token {token_id}",
        )


async def _load_pool(name: str, user: dict) -> dict | None:
    """Default loader; production overrides via build_router(load_pool=...)."""
    raise NotImplementedError("inject load_pool via build_router(load_pool=...)")


async def _run_inference_stream(
    pool: dict, body: dict, request_id: str
) -> AsyncIterator[dict]:
    """Default stream runner; production overrides via build_router(run_inference_stream=...)."""
    raise NotImplementedError("inject run_inference_stream via build_router(run_inference_stream=...)")
    # make mypy/type checkers treat this as an async generator
    yield  # pragma: no cover


async def stream_pool_inference(
    *,
    pool_name: str,
    prompt: str,
    max_tokens: int,
    temperature: float = 0.7,
    _pool: dict | None = None,
    _run_stream: Callable[..., AsyncIterator[dict]] | None = None,
) -> AsyncIterator[dict]:
    """Core token-yielding async generator.

    Yields ``{"token": str}`` for each token and ends with
    ``{"done": True, "tokens_in": int, "tokens_out": int}``.

    The private ``_pool`` and ``_run_stream`` parameters are used by the
    route (which already has both objects) and by tests (which mock them).
    When called standalone without those arguments the module-level
    ``_load_pool`` / ``_run_inference_stream`` stubs are used — they raise
    ``NotImplementedError`` unless patched.
    """
    if _pool is None:
        # No user context available at this level; load_pool requires one.
        # Callers that need auth must pass _pool directly.
        _pool = await _load_pool(pool_name, {})

    run_stream = _run_stream if _run_stream is not None else _run_inference_stream

    body = {"prompt": prompt, "max_tokens": max_tokens, "temperature": temperature}
    request_id = str(uuid.uuid4())

    tokens_in = 0
    tokens_out = 0

    async for ev in run_stream(pool=_pool, body=body, request_id=request_id):
        event_type = ev.get("event")
        if event_type == "token":
            token_text = ev.get("token", "")
            tokens_out += 1
            yield {"token": token_text}
        elif event_type == "meta":
            tokens_in = ev.get("tokens_in", tokens_in)
        elif event_type == "done":
            tokens_in = ev.get("tokens_in", tokens_in)
            tokens_out = ev.get("tokens_out", tokens_out)

    yield {"done": True, "tokens_in": tokens_in, "tokens_out": tokens_out}


async def run_pool_inference(
    *,
    pool_name: str,
    prompt: str,
    max_tokens: int,
    temperature: float = 0.7,
    _pool: dict | None = None,
    _run_stream: Callable[..., AsyncIterator[dict]] | None = None,
) -> dict:
    """Drain ``stream_pool_inference`` into a single result dict.

    Returns::

        {
            "output": "<concatenated tokens>",
            "tokens_in": int,
            "tokens_out": int,
            "hit_max": bool,
        }
    """
    tokens: list[str] = []
    tokens_in = 0
    tokens_out = 0

    async for ev in stream_pool_inference(
        pool_name=pool_name,
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        _pool=_pool,
        _run_stream=_run_stream,
    ):
        if "token" in ev:
            tokens.append(ev["token"])
        elif ev.get("done"):
            tokens_in = ev["tokens_in"]
            tokens_out = ev["tokens_out"]

    return {
        "output": "".join(tokens),
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "hit_max": tokens_out >= max_tokens,
    }


def build_router(
    *,
    economics,
    run_inference: Callable[..., Awaitable[dict]],
    run_inference_stream: Callable[..., AsyncIterator[Dict[str, Any]]] | None = None,
    load_pool: Callable[..., Awaitable[dict | None]] | None = None,
    http: httpx.AsyncClient | None = None,
) -> APIRouter:
    router = APIRouter()
    settings = get_settings()

    @router.post("/pools/{name}/infer")
    async def infer(
        name: str,
        request: Request,
        user: dict = Depends(get_current_user),
        x_payment: str | None = Header(default=None, alias="X-PAYMENT"),
    ):
        body = await request.json()
        max_tokens = int(body.get("max_tokens", 64))
        # Resolve at call time so tests can patch _load_pool via the module global.
        lp = load_pool if load_pool is not None else _load_pool
        pool = await lp(name, user)
        if pool is None or pool.get("state") not in ("ready", "loaded"):
            raise HTTPException(409, "pool not ready")

        # PoolINFT authorization gate (Task A14).
        # Only active when pool has inft_token_id AND app.state.inft_client is wired.
        await _check_inft_authorization(request, pool)

        requirements = build_payment_requirements(
            resource=f"/pools/{name}/infer",
            max_amount_micro=max_tokens * settings.x402_default_price_per_token_usdc_micro,
            description=f"compute-pool inference on {pool.get('model_name','?')}",
        )

        if not x_payment:
            return JSONResponse(status_code=402, content={
                "x402Version": 1,
                "accepts": [requirements],
                "error": "X-PAYMENT header is required",
            })

        try:
            payment = parse_payment_header(x_payment)
        except Exception as e:
            return JSONResponse(status_code=402, content={
                "x402Version": 1,
                "accepts": [requirements],
                "error": f"unparseable X-PAYMENT: {e}",
            })

        verify = await verify_via_facilitator(payment, requirements, http=http)
        if not verify.get("isValid"):
            return JSONResponse(status_code=402, content={
                "x402Version": 1,
                "accepts": [requirements],
                "error": verify.get("invalidReason", "verification failed"),
            })

        request_id = str(uuid.uuid4())
        amount_wei = int(requirements["maxAmountRequired"]) * 10**12
        duration_estimate = max_tokens * settings.seconds_per_token_estimate
        await economics.on_payment_received(
            pool_id=str(pool["_id"]),
            payer=verify.get("payer"),
            amount_usdc_micro=int(requirements["maxAmountRequired"]),
            amount_usdcx_wei=amount_wei,
            estimated_duration_s=duration_estimate,
            inference_request_id=request_id,
        )
        try:
            result = await run_inference(pool=pool, body=body)
        finally:
            await economics.on_inference_complete(
                pool_id=str(pool["_id"]),
                inference_request_id=request_id,
            )

        settle = await settle_via_facilitator(payment, requirements, http=http)
        if not settle.get("success"):
            logger.error("x402 settle failed after inference req=%s settle=%s", request_id, settle)
            await economics.mark_settled(inference_request_id=request_id, settle_tx=None)
            return JSONResponse(status_code=200, content=result, headers={
                "X-PAYMENT-RESPONSE": build_payment_response_header(settle),
                "X-PAYMENT-ERROR": settle.get("errorReason", "settle failed"),
            })

        await economics.mark_settled(
            inference_request_id=request_id, settle_tx=settle.get("transaction"),
        )
        return JSONResponse(status_code=200, content=result, headers={
            "X-PAYMENT-RESPONSE": build_payment_response_header(settle),
        })

    @router.post("/pools/{name}/infer/verify")
    async def infer_verify(
        name: str,
        request: Request,
        user: dict = Depends(get_current_user),
        x_payment: str | None = Header(default=None, alias="X-PAYMENT"),
    ):
        """Verify-only path: same x402 prelude as /infer/stream, but returns
        a JSON {isValid, invalidReason, payer, requirements} immediately
        without starting inference, charging the user, or settling. Lets the
        UI catch bad signatures / insufficient balance / wrong chain on the
        review screen instead of after navigating to the active screen.
        """
        body = await request.json()
        max_tokens = int(body.get("max_tokens", 64))
        lp = load_pool if load_pool is not None else _load_pool
        pool = await lp(name, user)
        if pool is None or pool.get("state") not in ("ready", "loaded"):
            raise HTTPException(409, "pool not ready")

        requirements = build_payment_requirements(
            resource=f"/pools/{name}/infer/stream",
            max_amount_micro=max_tokens * settings.x402_default_price_per_token_usdc_micro,
            description=f"compute-pool streaming inference on {pool.get('model_name','?')}",
        )

        if not x_payment:
            return JSONResponse(status_code=200, content={
                "isValid": False,
                "invalidReason": "X-PAYMENT header is required",
                "requirements": requirements,
            })
        try:
            payment = parse_payment_header(x_payment)
        except Exception as e:
            return JSONResponse(status_code=200, content={
                "isValid": False,
                "invalidReason": f"unparseable X-PAYMENT: {e}",
                "requirements": requirements,
            })
        verify = await verify_via_facilitator(payment, requirements, http=http)
        return JSONResponse(status_code=200, content={
            "isValid": bool(verify.get("isValid")),
            "invalidReason": verify.get("invalidReason"),
            "payer": verify.get("payer"),
            "requirements": requirements,
        })

    @router.post("/pools/{name}/infer/stream")
    async def infer_stream(
        name: str,
        request: Request,
        user: dict = Depends(get_current_user),
        x_payment: str | None = Header(default=None, alias="X-PAYMENT"),
    ):
        if run_inference_stream is None:
            raise HTTPException(501, "streaming not configured")

        body = await request.json()
        max_tokens = int(body.get("max_tokens", 64))
        lp = load_pool if load_pool is not None else _load_pool
        pool = await lp(name, user)
        if pool is None or pool.get("state") not in ("ready", "loaded"):
            raise HTTPException(409, "pool not ready")

        requirements = build_payment_requirements(
            resource=f"/pools/{name}/infer/stream",
            max_amount_micro=max_tokens * settings.x402_default_price_per_token_usdc_micro,
            description=f"compute-pool streaming inference on {pool.get('model_name','?')}",
        )

        if not x_payment:
            return JSONResponse(status_code=402, content={
                "x402Version": 1,
                "accepts": [requirements],
                "error": "X-PAYMENT header is required",
            })
        try:
            payment = parse_payment_header(x_payment)
        except Exception as e:
            return JSONResponse(status_code=402, content={
                "x402Version": 1,
                "accepts": [requirements],
                "error": f"unparseable X-PAYMENT: {e}",
            })

        verify = await verify_via_facilitator(payment, requirements, http=http)
        if not verify.get("isValid"):
            return JSONResponse(status_code=402, content={
                "x402Version": 1,
                "accepts": [requirements],
                "error": verify.get("invalidReason", "verification failed"),
            })

        request_id = str(uuid.uuid4())
        amount_wei = int(requirements["maxAmountRequired"]) * 10**12
        duration_estimate = max_tokens * settings.seconds_per_token_estimate
        await economics.on_payment_received(
            pool_id=str(pool["_id"]),
            payer=verify.get("payer"),
            amount_usdc_micro=int(requirements["maxAmountRequired"]),
            amount_usdcx_wei=amount_wei,
            estimated_duration_s=duration_estimate,
            inference_request_id=request_id,
        )

        prompt = body.get("prompt", "")
        temperature = float(body.get("temperature", 0.7))

        async def event_stream():
            saw_done = False
            try:
                async for ev in stream_pool_inference(
                    pool_name=name,
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    _pool=pool,
                    _run_stream=run_inference_stream,
                ):
                    if ev.get("done"):
                        saw_done = True
                    yield f"data: {json.dumps(ev)}\n\n"
            except Exception as e:
                logger.exception("infer_stream upstream failed req=%s", request_id)
                yield f"data: {json.dumps({'event': 'error', 'request_id': request_id, 'error': repr(e)})}\n\n"
            finally:
                await economics.on_inference_complete(
                    pool_id=str(pool["_id"]),
                    inference_request_id=request_id,
                )

            # Settle after the upstream stream is fully consumed. Emit the
            # x402 receipt as a final SSE event since headers are long gone.
            if not saw_done:
                yield f"data: {json.dumps({'event': 'settle', 'success': False, 'error': 'stream did not complete', 'request_id': request_id})}\n\n"
                await economics.mark_settled(inference_request_id=request_id, settle_tx=None)
                return

            settle = await settle_via_facilitator(payment, requirements, http=http)
            if not settle.get("success"):
                logger.error("x402 settle failed after stream req=%s settle=%s", request_id, settle)
                await economics.mark_settled(inference_request_id=request_id, settle_tx=None)
            else:
                await economics.mark_settled(
                    inference_request_id=request_id, settle_tx=settle.get("transaction"),
                )
            yield f"data: {json.dumps({'event': 'settle', 'request_id': request_id, **settle})}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    return router
