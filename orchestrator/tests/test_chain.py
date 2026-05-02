from unittest.mock import AsyncMock, patch
import pytest


@pytest.mark.asyncio
async def test_get_super_token_balance():
    from orchestrator.chain import Chain

    chain = Chain(rpc_url="http://stub", chain_id=16602,
                  usdcx_address="0x0000000000000000000000000000000000000001",
                  gda_forwarder="0x0000000000000000000000000000000000000002",
                  coalition_address="0x6647E81040a3E9BF658e107360c638c5DD04d1eF")
    with patch.object(chain.usdcx.functions, "balanceOf") as bo:
        bo.return_value.call = AsyncMock(return_value=42)
        v = await chain.get_super_token_balance("0x000000000000000000000000000000000000bEEF")
        assert v == 42
