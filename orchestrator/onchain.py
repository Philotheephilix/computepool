"""Direct on-chain submission helpers for the orchestrator.

Why this exists:
    The architecture intends KeeperHub workflows to broker every on-chain write
    (Coalition.propose / activate, GDA createPool / updateMemberUnits /
    distributeFlow). On 0G Galileo (chainId 16602) the KH `web3/write-contract`
    action's broadcast pipeline hangs server-side: every execution sits in
    `status: running` until either the inner step times out (`exceeded max
    retries`) or Cloudflare cuts the upstream after 124s with HTTP 524. The KH
    wallet's nonce on 0G stays at 0 — no transaction is ever submitted.

    Sepolia control flows succeed in 10-15s with the identical request shape;
    the bug is specific to KH's 0G handler. The `priority_fee_gwei` override on
    `execute_contract_call` is honored on Sepolia (proven: effective gas price
    ~2 Gwei) but doesn't change the 0G hang. Independently, direct web3.py
    broadcasts with a 2 Gwei priority tip succeed on 0G in seconds — so the
    chain itself is fine.

    Until KH ships the 0G fix, this module bypasses KH for the five write
    actions and submits transactions directly using ORCHESTRATOR_PRIVATE_KEY.
    KH still authors the workflow scaffolding and the webhook callback shape
    is preserved so the rest of the orchestrator pipeline (and the workflow
    JSON exports under keeperhub/) remains unchanged.
"""
from __future__ import annotations

import json
from web3 import AsyncWeb3, AsyncHTTPProvider
from eth_account import Account


# Minimum priority fee on 0G's mempool. Direct test confirmed:
#   1 wei -> rejected with `gas tip cap 1, minimum needed 2000000000`
#   2 Gwei -> accepted in ~9s.
DEFAULT_PRIORITY_FEE_WEI = 2_500_000_000  # 2.5 Gwei (above 0G's 2 Gwei floor)


COALITION_ABI = json.loads("""[
  {"name":"propose","type":"function","stateMutability":"nonpayable",
   "inputs":[
     {"name":"participants","type":"address[]"},
     {"name":"termsHash","type":"bytes32"},
     {"name":"deadline","type":"uint256"},
     {"name":"stakeToken","type":"address"},
     {"name":"stakePerParty","type":"uint256"}],
   "outputs":[{"name":"coalitionId","type":"uint256"}]},
  {"name":"activate","type":"function","stateMutability":"nonpayable",
   "inputs":[{"name":"coalitionId","type":"uint256"}],"outputs":[]},
  {"anonymous":false,"name":"Proposed","type":"event",
   "inputs":[
     {"indexed":true,"name":"id","type":"uint256"},
     {"indexed":false,"name":"termsHash","type":"bytes32"},
     {"indexed":false,"name":"participants","type":"address[]"},
     {"indexed":false,"name":"stakeToken","type":"address"},
     {"indexed":false,"name":"stakePerParty","type":"uint256"},
     {"indexed":false,"name":"deadline","type":"uint256"}]}
]""")


GDA_FORWARDER_ABI = json.loads("""[
  {"name":"createPool","type":"function","stateMutability":"nonpayable",
   "inputs":[
     {"name":"token","type":"address"},
     {"name":"admin","type":"address"},
     {"name":"config","type":"tuple","components":[
       {"name":"transferabilityForUnitsOwner","type":"bool"},
       {"name":"distributionFromAnyAddress","type":"bool"}]}],
   "outputs":[
     {"name":"success","type":"bool"},
     {"name":"pool","type":"address"}]},
  {"name":"updateMemberUnits","type":"function","stateMutability":"nonpayable",
   "inputs":[
     {"name":"pool","type":"address"},
     {"name":"memberAddress","type":"address"},
     {"name":"newUnits","type":"uint128"},
     {"name":"userData","type":"bytes"}],
   "outputs":[{"type":"bool"}]},
  {"name":"distributeFlow","type":"function","stateMutability":"nonpayable",
   "inputs":[
     {"name":"token","type":"address"},
     {"name":"from","type":"address"},
     {"name":"pool","type":"address"},
     {"name":"requestedFlowRate","type":"int96"},
     {"name":"userData","type":"bytes"}],
   "outputs":[{"type":"bool"}]}
]""")


class OnchainSubmitter:
    def __init__(
        self,
        *,
        rpc_url: str,
        chain_id: int,
        private_key: str,
        coalition_address: str,
        gda_forwarder: str,
        priority_fee_wei: int = DEFAULT_PRIORITY_FEE_WEI,
    ):
        self.w3 = AsyncWeb3(AsyncHTTPProvider(rpc_url))
        self.chain_id = chain_id
        self.account = Account.from_key(private_key)
        self.priority_fee_wei = priority_fee_wei
        self.coalition = self.w3.eth.contract(
            address=AsyncWeb3.to_checksum_address(coalition_address),
            abi=COALITION_ABI,
        )
        self.gda = self.w3.eth.contract(
            address=AsyncWeb3.to_checksum_address(gda_forwarder),
            abi=GDA_FORWARDER_ABI,
        )

    @property
    def address(self) -> str:
        return self.account.address

    async def _send(self, contract_function, *, gas: int = 800_000) -> dict:
        nonce = await self.w3.eth.get_transaction_count(self.account.address)
        block = await self.w3.eth.get_block("latest")
        base = block["baseFeePerGas"]
        tx = await contract_function.build_transaction({
            "chainId": self.chain_id,
            "from": self.account.address,
            "nonce": nonce,
            "gas": gas,
            "maxFeePerGas": base + self.priority_fee_wei + 1_000_000_000,
            "maxPriorityFeePerGas": self.priority_fee_wei,
            "type": 2,
        })
        signed = self.account.sign_transaction(tx)
        h = await self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = await self.w3.eth.wait_for_transaction_receipt(h, timeout=120)
        if receipt["status"] != 1:
            raise RuntimeError(f"tx reverted: {h.hex()}")
        return {"tx_hash": "0x" + h.hex().removeprefix("0x"), "receipt": receipt}

    async def propose(
        self,
        *,
        participants: list[str],
        terms_hash: str,
        deadline_unix: int,
        stake_token: str,
        stake_per_party: int,
    ) -> dict:
        fn = self.coalition.functions.propose(
            [AsyncWeb3.to_checksum_address(p) for p in participants],
            bytes.fromhex(terms_hash.removeprefix("0x")),
            deadline_unix,
            AsyncWeb3.to_checksum_address(stake_token),
            stake_per_party,
        )
        result = await self._send(fn, gas=600_000)
        # Decode coalitionId from the Proposed event log.
        onchain_id = None
        for log in result["receipt"].get("logs", []):
            try:
                evt = self.coalition.events.Proposed().process_log(log)
            except Exception:
                continue
            cid = (evt.get("args") or {}).get("id")
            if cid is not None:
                onchain_id = int(cid)
                break
        return {"tx_hash": result["tx_hash"], "onchain_id": onchain_id}

    async def activate(self, *, onchain_id: int) -> dict:
        fn = self.coalition.functions.activate(onchain_id)
        return await self._send(fn, gas=300_000)

    async def create_pool(
        self,
        *,
        super_token: str,
        admin: str,
    ) -> dict:
        fn = self.gda.functions.createPool(
            AsyncWeb3.to_checksum_address(super_token),
            AsyncWeb3.to_checksum_address(admin),
            (False, False),
        )
        result = await self._send(fn, gas=2_000_000)
        # createPool returns (success, pool); decode from the call result via
        # eth_call replay against the original tx (the receipt only has logs).
        tx = await self.w3.eth.get_transaction(result["tx_hash"])
        raw = await self.w3.eth.call(
            {"from": tx["from"], "to": tx["to"], "data": tx["input"]},
            tx["blockNumber"] - 1,
        )
        # ABI-packed (bool success, address pool); pool starts at byte 44.
        pool_addr = AsyncWeb3.to_checksum_address("0x" + raw[44:64].hex())
        return {"tx_hash": result["tx_hash"], "pool_address": pool_addr}

    async def update_member_units(
        self,
        *,
        pool: str,
        member: str,
        units: int,
    ) -> dict:
        fn = self.gda.functions.updateMemberUnits(
            AsyncWeb3.to_checksum_address(pool),
            AsyncWeb3.to_checksum_address(member),
            units,
            b"",
        )
        return await self._send(fn, gas=600_000)

    async def distribute_flow(
        self,
        *,
        super_token: str,
        sender: str,
        pool: str,
        flow_rate_wei_per_sec: int,
    ) -> dict:
        fn = self.gda.functions.distributeFlow(
            AsyncWeb3.to_checksum_address(super_token),
            AsyncWeb3.to_checksum_address(sender),
            AsyncWeb3.to_checksum_address(pool),
            flow_rate_wei_per_sec,
            b"",
        )
        return await self._send(fn, gas=1_500_000)
