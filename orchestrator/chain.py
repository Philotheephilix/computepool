import json
from web3 import AsyncWeb3, AsyncHTTPProvider


SUPER_TOKEN_ABI = json.loads("""[
  {"name":"balanceOf","type":"function","stateMutability":"view",
   "inputs":[{"name":"a","type":"address"}],"outputs":[{"type":"uint256"}]}
]""")

GDA_FORWARDER_ABI = json.loads("""[
  {"name":"getNetFlow","type":"function","stateMutability":"view",
   "inputs":[
     {"name":"token","type":"address"},
     {"name":"account","type":"address"}
   ],"outputs":[{"type":"int96"}]},
  {"name":"getPoolAdjustmentFlowRate","type":"function","stateMutability":"view",
   "inputs":[{"name":"pool","type":"address"}],
   "outputs":[{"type":"int96"}]}
]""")

POOL_ABI = json.loads("""[
  {"name":"getUnits","type":"function","stateMutability":"view",
   "inputs":[{"name":"member","type":"address"}],"outputs":[{"type":"uint128"}]},
  {"name":"getTotalUnits","type":"function","stateMutability":"view",
   "inputs":[],"outputs":[{"type":"uint128"}]}
]""")

COALITION_ABI = json.loads("""[
  {"name":"coalitions","type":"function","stateMutability":"view",
   "inputs":[{"name":"id","type":"uint256"}],
   "outputs":[
     {"name":"termsHash","type":"bytes32"},
     {"name":"stakeToken","type":"address"},
     {"name":"stakePerParty","type":"uint256"},
     {"name":"deadline","type":"uint256"},
     {"name":"signedCount","type":"uint8"},
     {"name":"breachedCount","type":"uint8"},
     {"name":"state","type":"uint8"}
   ]},
  {"name":"nextId","type":"function","stateMutability":"view","inputs":[],
   "outputs":[{"type":"uint256"}]},
  {"name":"Proposed","type":"event","anonymous":false,
   "inputs":[
     {"indexed":true,"name":"id","type":"uint256"},
     {"indexed":false,"name":"termsHash","type":"bytes32"},
     {"indexed":false,"name":"participants","type":"address[]"},
     {"indexed":false,"name":"stakeToken","type":"address"},
     {"indexed":false,"name":"stakePerParty","type":"uint256"},
     {"indexed":false,"name":"deadline","type":"uint256"}
   ]}
]""")


class Chain:
    def __init__(self, *, rpc_url: str, chain_id: int,
                 usdcx_address: str, gda_forwarder: str, coalition_address: str):
        self.w3 = AsyncWeb3(AsyncHTTPProvider(rpc_url))
        self.chain_id = chain_id
        self.usdcx = self.w3.eth.contract(
            address=AsyncWeb3.to_checksum_address(usdcx_address), abi=SUPER_TOKEN_ABI)
        self.gda = self.w3.eth.contract(
            address=AsyncWeb3.to_checksum_address(gda_forwarder), abi=GDA_FORWARDER_ABI)
        self.coalition = self.w3.eth.contract(
            address=AsyncWeb3.to_checksum_address(coalition_address), abi=COALITION_ABI)
        self._usdcx_addr = usdcx_address

    async def get_super_token_balance(self, addr: str) -> int:
        return await self.usdcx.functions.balanceOf(
            AsyncWeb3.to_checksum_address(addr)).call()

    async def get_member_net_flow(self, account: str) -> int:
        return await self.gda.functions.getNetFlow(
            AsyncWeb3.to_checksum_address(self._usdcx_addr),
            AsyncWeb3.to_checksum_address(account)).call()

    async def get_pool_member_units(self, pool: str, member: str) -> int:
        c = self.w3.eth.contract(address=AsyncWeb3.to_checksum_address(pool), abi=POOL_ABI)
        return await c.functions.getUnits(AsyncWeb3.to_checksum_address(member)).call()

    async def get_pool_total_units(self, pool: str) -> int:
        c = self.w3.eth.contract(address=AsyncWeb3.to_checksum_address(pool), abi=POOL_ABI)
        return await c.functions.getTotalUnits().call()

    async def get_proposed_id_from_tx(self, tx_hash: str) -> int | None:
        """Look up the on-chain coalition id from a Coalition.propose tx.

        Reads the Proposed event from the receipt's logs. Returns None if no
        Proposed log is found.
        """
        receipt = await self.w3.eth.get_transaction_receipt(tx_hash)
        for log in receipt.get("logs", []):
            try:
                evt = self.coalition.events.Proposed().process_log(log)
            except Exception:
                continue
            args = evt.get("args") or {}
            cid = args.get("id")
            if cid is not None:
                return int(cid)
        return None

    async def get_coalition_state(self, onchain_id: int) -> dict:
        out = await self.coalition.functions.coalitions(onchain_id).call()
        return {
            "terms_hash": out[0].hex() if isinstance(out[0], (bytes, bytearray)) else out[0],
            "stake_token": out[1],
            "stake_per_party": int(out[2]),
            "deadline": int(out[3]),
            "signed_count": int(out[4]),
            "breached_count": int(out[5]),
            "state": int(out[6]),
        }
