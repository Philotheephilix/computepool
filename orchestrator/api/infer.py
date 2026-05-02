import logging
import uuid
from typing import Awaitable, Callable
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
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


async def _load_pool(name: str, user: dict) -> dict | None:
    """Default loader; production overrides via build_router(load_pool=...)."""
    raise NotImplementedError("inject load_pool via build_router(load_pool=...)")


def build_router(
    *,
    economics,
    run_inference: Callable[..., Awaitable[dict]],
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

    return router
