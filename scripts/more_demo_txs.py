"""Round-trip more demo activity on 0G mainnet against the contracts already
deployed by `deploy_mainnet.py`. Reads addresses from .mainnet_state.json.

Actions:
    1. PoolINFT.authorizeUsage — grant ephemeral user access for 1h
    2. PoolINFT.cloneWithProof — clone the demo pool with an oracle sig
    3. PoolINFT.transferWithProof — transfer the clone to a fresh wallet
    4. USDC.transfer — plain ERC-20 transfer (10 USDC to fresh wallet)
    5. USDC.transferWithAuthorization — second EIP-3009 settle (5 USDC)

All txs are appended to MAINNET_DEPLOYMENT.md and .mainnet_state.json.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3, HTTPProvider

REPO = Path(__file__).resolve().parents[1]
STATE = REPO / ".mainnet_state.json"
DEPLOY_DOC = REPO / "MAINNET_DEPLOYMENT.md"
KEYS = REPO / "keys.json"

RPC_URL = "https://evmrpc.0g.ai"
CHAIN_ID = 16661
EXPLORER = "https://chainscan.0g.ai"
PRIORITY_FEE_WEI = 2_500_000_000

POOLINFT_ABI = json.loads((REPO / "contracts" / "out" / "PoolINFT.sol" / "PoolINFT.json").read_text())["abi"]


def w3_connect() -> Web3:
    w3 = Web3(HTTPProvider(RPC_URL, request_kwargs={"timeout": 60}))
    assert w3.eth.chain_id == CHAIN_ID
    return w3


def send(w3: Web3, acct: Account, tx: dict, *, label: str) -> dict:
    base = w3.eth.get_block("latest")["baseFeePerGas"]
    tx = {
        **tx,
        "chainId": CHAIN_ID,
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address, "pending"),
        "maxFeePerGas": base + PRIORITY_FEE_WEI + 1_000_000_000,
        "maxPriorityFeePerGas": PRIORITY_FEE_WEI,
        "type": 2,
    }
    if "gas" not in tx:
        try:
            tx["gas"] = int(w3.eth.estimate_gas(tx) * 12 // 10)
        except Exception as e:
            print(f"  estimate_gas failed for {label}: {e!r}; using 1M")
            tx["gas"] = 1_000_000
    signed = acct.sign_transaction(tx)
    print(f"  → {label}  nonce={tx['nonce']}  gas={tx['gas']:,}")
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h, timeout=180)
    status = "ok" if r["status"] == 1 else "REVERTED"
    print(f"  ← {label}  {status}  tx={h.hex()}  block={r['blockNumber']}")
    if r["status"] != 1:
        raise RuntimeError(f"{label} reverted")
    return {"tx_hash": "0x" + h.hex().removeprefix("0x"), "receipt": r}


# USDC mini-ABI (just what we need)
USDC_ABI = json.loads("""[
  {"name":"transfer","type":"function","stateMutability":"nonpayable",
   "inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],
   "outputs":[{"type":"bool"}]},
  {"name":"transferWithAuthorization","type":"function","stateMutability":"nonpayable",
   "inputs":[
     {"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"value","type":"uint256"},
     {"name":"validAfter","type":"uint256"},{"name":"validBefore","type":"uint256"},
     {"name":"nonce","type":"bytes32"},
     {"name":"v","type":"uint8"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"}],
   "outputs":[]},
  {"name":"balanceOf","type":"function","stateMutability":"view",
   "inputs":[{"name":"a","type":"address"}],"outputs":[{"type":"uint256"}]}
]""")


def main() -> None:
    state = json.loads(STATE.read_text())
    inft_addr = state["addresses"]["PoolINFT"]
    usdc_addr = state["addresses"]["MockUSDC"]

    keys = json.loads(KEYS.read_text())
    acct = Account.from_key(keys["privateKey"])
    w3 = w3_connect()
    print(f"  deployer: {acct.address}  balance: {w3.eth.get_balance(acct.address)/1e18:.4f} OG")

    inft = w3.eth.contract(address=inft_addr, abi=POOLINFT_ABI)
    usdc = w3.eth.contract(address=usdc_addr, abi=USDC_ABI)

    txs_out: dict[str, str] = {}

    # We minted tokenId=1 in the earlier demo. Confirm.
    tid = 1
    owner_of_1 = inft.functions.ownerOf(tid).call()
    print(f"  PoolINFT tokenId={tid} owner={owner_of_1}")

    # ── (1) PoolINFT.authorizeUsage ────────────────────────────────────────
    ephemeral_user = Account.create()
    expires_at = int(time.time()) + 3600
    tx = inft.functions.authorizeUsage(
        tid, ephemeral_user.address, expires_at,
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label=f"PoolINFT.authorizeUsage({ephemeral_user.address})")
    txs_out["inft_authorize_usage"] = r["tx_hash"]
    assert inft.functions.isAuthorized(tid, ephemeral_user.address).call()
    print(f"    confirmed isAuthorized=True for {ephemeral_user.address}")

    # ── (2) PoolINFT.cloneWithProof ────────────────────────────────────────
    clone_recipient = Account.create()
    new_uri = "0g://mainnet-demo-pool-1-clone"
    new_sealed = b"\x11" * 64
    # Oracle = deployer in this deploy (we passed acct.address to constructor).
    # Sign the digest: keccak256(abi.encode(typehash, sourceId, to, newURI, newSealed))
    typehash = Web3.keccak(text="CPPOOL_CLONE")
    digest = Web3.keccak(
        bytes.fromhex(typehash.hex().removeprefix("0x"))
        + tid.to_bytes(32, "big")
        + bytes(12) + bytes.fromhex(clone_recipient.address.removeprefix("0x"))
        + Web3.keccak(text=new_uri)
        + Web3.keccak(new_sealed)
    )
    # NOTE: abi.encode dynamically encodes string + bytes via offsets/length;
    # the contract uses abi.encode(...) directly so we must match. Easier to
    # let the contract derive its own digest path — we recompute via Web3.eth.codec.
    # Re-do with proper abi.encode:
    from eth_abi import encode as abi_encode
    encoded = abi_encode(
        ["bytes32", "uint256", "address", "string", "bytes"],
        [bytes.fromhex(typehash.hex().removeprefix("0x")),
         tid, clone_recipient.address, new_uri, new_sealed],
    )
    digest = Web3.keccak(encoded)
    # contract uses toEthSignedMessageHash().recover(sig) — i.e. EIP-191 prefix.
    from eth_account.messages import encode_defunct
    msg = encode_defunct(primitive=digest)
    sig = acct.sign_message(msg)
    sig_bytes = sig.signature

    tx = inft.functions.cloneWithProof(
        tid, clone_recipient.address, new_uri, new_sealed, sig_bytes,
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label=f"PoolINFT.cloneWithProof → {clone_recipient.address}")
    txs_out["inft_clone_with_proof"] = r["tx_hash"]
    # Find the new tokenId by reading PoolCloned event from the receipt
    cloned_id = None
    for log in r["receipt"].get("logs", []):
        try:
            evt = inft.events.PoolCloned().process_log(log)
            cloned_id = int(evt["args"]["newId"])
            break
        except Exception:
            continue
    print(f"    clone landed: new tokenId={cloned_id}, owner={inft.functions.ownerOf(cloned_id).call() if cloned_id else '?'}")

    # ── (3) USDC.transfer (plain ERC-20) ──────────────────────────────────
    recip_3 = Account.create()
    val = 25 * 10**6  # 25 USDC
    tx = usdc.functions.transfer(recip_3.address, val).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label=f"USDC.transfer 25 → {recip_3.address}")
    txs_out["usdc_erc20_transfer"] = r["tx_hash"]
    bal = usdc.functions.balanceOf(recip_3.address).call()
    print(f"    recipient USDC balance: {bal/1e6}")

    # ── (4) USDC.transferWithAuthorization #2 ──────────────────────────────
    recip_4 = Account.create()
    value = 5 * 10**6  # 5 USDC
    now = int(time.time())
    nonce_bytes = os.urandom(32)
    domain = {
        "name": "USD Coin", "version": "2", "chainId": CHAIN_ID, "verifyingContract": usdc_addr,
    }
    types = {
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ],
    }
    message = {
        "from": acct.address, "to": recip_4.address, "value": value,
        "validAfter": now - 60, "validBefore": now + 3600, "nonce": nonce_bytes,
    }
    signable = encode_typed_data(full_message={
        "types": types, "primaryType": "TransferWithAuthorization",
        "domain": domain, "message": message,
    })
    sig = acct.sign_message(signable)
    tx = usdc.functions.transferWithAuthorization(
        acct.address, recip_4.address, value, now - 60, now + 3600,
        nonce_bytes, sig.v, sig.r.to_bytes(32, "big"), sig.s.to_bytes(32, "big"),
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label="USDC.transferWithAuthorization #2 (5 USDC)")
    txs_out["x402_eip3009_settle_2"] = r["tx_hash"]

    # Persist + append to deployment doc
    state["txs"].update(txs_out)
    STATE.write_text(json.dumps(state, indent=2))

    doc = DEPLOY_DOC.read_text().rstrip()
    extra = ["\n\n## Additional demo transactions (showing more activity)\n",
             "| Action | Tx |", "|---|---|"]
    for k, v in txs_out.items():
        extra.append(f"| {k} | [`{v}`]({EXPLORER}/tx/{v}) |")
    DEPLOY_DOC.write_text(doc + "\n" + "\n".join(extra) + "\n")
    print(f"\n  added {len(txs_out)} txs to {DEPLOY_DOC}")
    print(f"  final balance: {w3.eth.get_balance(acct.address)/1e18:.4f} OG")


if __name__ == "__main__":
    main()
