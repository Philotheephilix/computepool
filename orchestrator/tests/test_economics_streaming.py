import pytest
from unittest.mock import AsyncMock

from orchestrator.economics import EconomicsService


class _Coll:
    def __init__(self, items=None):
        self.items = list(items or [])
        self.inserted = []
        self.updates = []

    async def insert_one(self, d):
        self.inserted.append(d)

    async def update_one(self, q, u):
        self.updates.append((q, u))

    async def find_one(self, q):
        for d in self.items:
            if all(d.get(k) == v for k, v in q.items()):
                return d
        return None


def _onchain_mock():
    """Mock the OnchainSubmitter facade exposed by orchestrator.onchain."""
    m = AsyncMock()
    m.address = "0xorchestrator"
    m.distribute_flow = AsyncMock(return_value={"tx_hash": "0xdeadbeef"})
    m.propose = AsyncMock(return_value={"tx_hash": "0xfeed", "onchain_id": 1})
    return m


@pytest.mark.asyncio
async def test_on_payment_received_starts_stream(_orchestrator_env):
    from orchestrator.settings import get_settings

    settings = get_settings()
    db = type("DB", (), {})()
    db.payment_pools = _Coll(
        [
            {
                "pool_id": "p1",
                "superfluid_pool_address": "0xpool",
                "super_token": settings.usdcx_address,
            }
        ]
    )
    db.payments = _Coll()
    kh = AsyncMock()
    onchain = _onchain_mock()
    svc = EconomicsService(
        db=db, kh=kh, chain=None, settings=settings, http=AsyncMock(), onchain=onchain
    )

    await svc.on_payment_received(
        pool_id="p1",
        payer="0xa",
        amount_usdc_micro=1000,
        amount_usdcx_wei=1_000_000_000_000_000,
        estimated_duration_s=10.0,
        inference_request_id="req-1",
    )
    # Payment recorded
    assert db.payments.inserted[0]["_id"] == "req-1"
    # Stream-start path goes onchain (KH path is gated off pending KH 0G fix)
    onchain.distribute_flow.assert_awaited_once()
    kwargs = onchain.distribute_flow.call_args.kwargs
    assert kwargs["pool"] == "0xpool"
    assert kwargs["super_token"] == settings.usdcx_address
    assert kwargs["sender"] == onchain.address
    assert int(kwargs["flow_rate_wei_per_sec"]) > 0
    # KH workflow is NOT invoked while the workaround is active
    kh.execute_workflow.assert_not_awaited()


@pytest.mark.asyncio
async def test_on_inference_complete_stops_stream(_orchestrator_env):
    from orchestrator.settings import get_settings

    settings = get_settings()
    db = type("DB", (), {})()
    db.payment_pools = _Coll(
        [
            {
                "pool_id": "p1",
                "superfluid_pool_address": "0xpool",
                "super_token": settings.usdcx_address,
            }
        ]
    )
    db.payments = _Coll()
    kh = AsyncMock()
    onchain = _onchain_mock()
    svc = EconomicsService(
        db=db, kh=kh, chain=None, settings=settings, http=AsyncMock(), onchain=onchain
    )

    await svc.on_inference_complete(pool_id="p1", inference_request_id="req-1")
    # Stream-stop = distributeFlow with rate 0
    onchain.distribute_flow.assert_awaited_once()
    kwargs = onchain.distribute_flow.call_args.kwargs
    assert kwargs["pool"] == "0xpool"
    assert int(kwargs["flow_rate_wei_per_sec"]) == 0
    kh.execute_workflow.assert_not_awaited()
