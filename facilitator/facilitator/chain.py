import json
from web3 import AsyncWeb3, AsyncHTTPProvider
from web3.contract import AsyncContract


USDC_ABI = json.loads("""[
  {"name": "balanceOf", "type": "function", "stateMutability": "view",
   "inputs": [{"name": "account", "type": "address"}],
   "outputs": [{"type": "uint256"}]},
  {"name": "authorizationState", "type": "function", "stateMutability": "view",
   "inputs": [{"name": "authorizer", "type": "address"}, {"name": "nonce", "type": "bytes32"}],
   "outputs": [{"type": "bool"}]},
  {"name": "transferWithAuthorization", "type": "function", "stateMutability": "nonpayable",
   "inputs": [
     {"name": "from", "type": "address"},
     {"name": "to", "type": "address"},
     {"name": "value", "type": "uint256"},
     {"name": "validAfter", "type": "uint256"},
     {"name": "validBefore", "type": "uint256"},
     {"name": "nonce", "type": "bytes32"},
     {"name": "v", "type": "uint8"},
     {"name": "r", "type": "bytes32"},
     {"name": "s", "type": "bytes32"}
   ],
   "outputs": []}
]""")


class Chain:
    def __init__(self, rpc_url: str, usdc_address: str, relayer_private_key: str):
        self.w3 = AsyncWeb3(AsyncHTTPProvider(rpc_url))
        self.usdc: AsyncContract = self.w3.eth.contract(
            address=AsyncWeb3.to_checksum_address(usdc_address), abi=USDC_ABI
        )
        self.relayer = self.w3.eth.account.from_key(relayer_private_key)

    async def usdc_balance(self, addr: str) -> int:
        return await self.usdc.functions.balanceOf(AsyncWeb3.to_checksum_address(addr)).call()

    async def is_nonce_used(self, signer: str, nonce_hex: str) -> bool:
        nonce = bytes.fromhex(nonce_hex[2:] if nonce_hex.startswith("0x") else nonce_hex)
        return await self.usdc.functions.authorizationState(
            AsyncWeb3.to_checksum_address(signer), nonce
        ).call()

    async def submit_transfer_with_authorization(
        self, *, frm: str, to: str, value: int,
        valid_after: int, valid_before: int, nonce: bytes,
        v: int, r: bytes, s: bytes,
    ) -> dict:
        nonce_count = await self.w3.eth.get_transaction_count(self.relayer.address)
        fn = self.usdc.functions.transferWithAuthorization(
            AsyncWeb3.to_checksum_address(frm),
            AsyncWeb3.to_checksum_address(to),
            value, valid_after, valid_before, nonce, v, r, s,
        )
        tx = await fn.build_transaction({
            "from": self.relayer.address,
            "nonce": nonce_count,
            "chainId": await self.w3.eth.chain_id,
        })
        try:
            est = await self.w3.eth.estimate_gas(tx)
            tx["gas"] = int(est * 1.2)
        except Exception:
            tx["gas"] = 200_000
        signed = self.relayer.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        tx_hash = await self.w3.eth.send_raw_transaction(raw)
        receipt = await self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return {
            "tx_hash": tx_hash.hex(),
            "status": int(receipt["status"]),
            "block_number": int(receipt["blockNumber"]),
        }
