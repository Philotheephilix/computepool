import base64
import json
import pytest
from unittest.mock import AsyncMock, patch
from orchestrator.x402 import (
    build_payment_requirements,
    parse_payment_header,
    verify_via_facilitator,
    settle_via_facilitator,
    build_payment_response_header,
)


def test_build_payment_requirements(_orchestrator_env):
    r = build_payment_requirements(resource="/pools/p/infer",
                                   max_amount_micro=10_000,
                                   description="test")
    assert r["scheme"] == "exact"
    assert r["network"] == "0g-galileo"
    assert r["maxAmountRequired"] == "10000"
    assert r["payTo"].startswith("0x")
    assert r["asset"].startswith("0x")


def test_parse_payment_header_roundtrip():
    payload = {
        "x402Version": 1, "scheme": "exact", "network": "0g-galileo",
        "payload": {"signature": "0xabc",
                    "authorization": {"from": "0x1", "to": "0x2", "value": "1",
                                       "validAfter": "0", "validBefore": "9",
                                       "nonce": "0x" + "00"*32}},
    }
    header = base64.b64encode(json.dumps(payload).encode()).decode()
    parsed = parse_payment_header(header)
    assert parsed["scheme"] == "exact"
    assert parsed["payload"]["signature"] == "0xabc"


@pytest.mark.asyncio
async def test_verify_via_facilitator(_orchestrator_env, httpx_mock):
    httpx_mock.add_response(
        url="http://localhost:4021/verify",
        json={"isValid": True, "payer": "0xabc"},
    )
    payment = {"x402Version": 1, "scheme": "exact", "network": "0g-galileo",
               "payload": {"signature": "0x", "authorization": {}}}
    requirements = build_payment_requirements(
        resource="/x", max_amount_micro=1, description="t")
    out = await verify_via_facilitator(payment, requirements)
    assert out["isValid"] is True


def test_build_payment_response_header():
    settle = {"success": True, "transaction": "0xfeed",
              "network": "0g-galileo", "payer": "0xpayer"}
    h = build_payment_response_header(settle)
    decoded = json.loads(base64.b64decode(h))
    assert decoded["transaction"] == "0xfeed"
