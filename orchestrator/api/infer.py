import logging
import uuid
from typing import Awaitable, Callable
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from ..settings import get_settings
from ..x402 import (
    build_payment_requirements,
    parse_payment_header,
    verify_via_facilitator,
    settle_via_facilitator,
    build_payment_response_header,
)


logger = logging.getLogger("discom.infer")


async def _load_pool(name: str) -> dict:
    """Replaced at startup; this default raises so tests must patch."""
    raise NotImplementedError("inject _load_pool via app.state in production")


def build_router(*, economics, run_inference: Callable[..., Awaitable[dict]],
                 load_pool: Callable[..., Awaitable[dict]] | None = None) -> APIRouter:
    router = APIRouter()
    settings = get_settings()
    global _load_pool
    if load_pool is not None:
        _load_pool = load_pool

    @router.post("/pools/{name}/infer")
    async def infer(name: str, request: Request,
                    x_payment: str | None = Header(default=None, alias="X-PAYMENT")):
        body = await request.json()
        max_tokens = int(body.get("max_tokens", 64))
        pool = await _load_pool(name)
        if pool is None or pool.get("state") not in ("ready", "loaded"):
            raise HTTPException(409, "pool not ready")

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

        verify = await verify_via_facilitator(payment, requirements)
        if not verify.get("isValid"):
            return JSONResponse(status_code=402, content={
                "x402Version": 1,
                "accepts": [requirements],
                "error": verify.get("invalidReason", "verification failed"),
            })

        # Order: stream-start -> infer -> stream-stop -> settle -> respond
        request_id = str(uuid.uuid4())
        amount_wei = int(requirements["maxAmountRequired"]) * 10**12  # USDC 6dp -> USDCx 18dp
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

        settle = await settle_via_facilitator(payment, requirements)
        if not settle.get("success"):
            logger.error("x402 settle failed after inference req=%s settle=%s", request_id, settle)
            await economics.mark_settled(
                inference_request_id=request_id, settle_tx=None
            )
            # Still return the result so the user keeps what they paid for
            return JSONResponse(status_code=200, content=result, headers={
                "X-PAYMENT-RESPONSE": build_payment_response_header(settle),
                "X-PAYMENT-ERROR": settle.get("errorReason", "settle failed"),
            })

        await economics.mark_settled(
            inference_request_id=request_id, settle_tx=settle.get("transaction")
        )
        return JSONResponse(status_code=200, content=result, headers={
            "X-PAYMENT-RESPONSE": build_payment_response_header(settle),
        })

    return router
