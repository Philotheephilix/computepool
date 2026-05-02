from unittest.mock import AsyncMock, patch
import pytest


@pytest.mark.asyncio
async def test_get_super_token_balance():
    from orchestrator.chain import Chain

    chain = Chain(rpc_url="http://stub", chain_id=11155111,
                  usdcx_address="0xb598E6C621618a9f63788816ffb50Ee2862D443B",
                  gda_forwarder="0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08",
                  coalition_address="0x000000000000000000000000000000000000C0A1")
    with patch.object(chain.usdcx.functions, "balanceOf") as bo:
        bo.return_value.call = AsyncMock(return_value=42)
        v = await chain.get_super_token_balance("0x000000000000000000000000000000000000bEEF")
        assert v == 42
