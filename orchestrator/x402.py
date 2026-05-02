import base64
import json
import httpx
from .settings import get_settings


def build_payment_requirements(*, resource: str, max_amount_micro: int,
                               description: str) -> dict:
    s = get_settings()
    return {
        "scheme": "exact",
        "network": "sepolia",
        "maxAmountRequired": str(max_amount_micro),
        "resource": resource,
        "description": description,
        "mimeType": "application/json",
        "payTo": s.orchestrator_wallet_address,
        "maxTimeoutSeconds": 60,
        "asset": s.usdc_address,
        "extra": {"name": "USD Coin", "version": "2"},
    }


def parse_payment_header(header: str) -> dict:
    raw = base64.b64decode(header)
    return json.loads(raw)


async def _post(http: httpx.AsyncClient | None, url: str, body: dict, timeout: float) -> dict:
    if http is not None:
        r = await http.post(url, json=body, timeout=timeout)
    else:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.post(url, json=body, timeout=timeout)
    r.raise_for_status()
    return r.json()


async def verify_via_facilitator(payment: dict, requirements: dict,
                                 *, http: httpx.AsyncClient | None = None) -> dict:
    s = get_settings()
    return await _post(
        http,
        s.x402_facilitator_url.rstrip("/") + "/verify",
        {"x402Version": 1, "paymentPayload": payment, "paymentRequirements": requirements},
        timeout=15.0,
    )


async def settle_via_facilitator(payment: dict, requirements: dict,
                                 *, http: httpx.AsyncClient | None = None) -> dict:
    s = get_settings()
    return await _post(
        http,
        s.x402_facilitator_url.rstrip("/") + "/settle",
        {"x402Version": 1, "paymentPayload": payment, "paymentRequirements": requirements},
        timeout=60.0,
    )


def build_payment_response_header(settle_result: dict) -> str:
    return base64.b64encode(json.dumps(settle_result).encode()).decode()
