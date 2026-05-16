"""Deploy ComputePool contracts to 0G mainnet (chainId 16661).

Run:
    cd computepool && source .venv/bin/activate
    python scripts/deploy_mainnet.py --phase all

Phases:
    poolinft   Deploy PoolINFT
    usdc       Deploy MockUSDC + mint 1,000,000 USDC to deployer
    demo       Mint INFT + signed USDC transferWithAuthorization
    superfluid (separate script; not run by default)
    all        poolinft + usdc + demo

The script reads the deployer key from keys.json at the repo root and writes
every deployed address + tx hash to .env.mainnet and MAINNET_DEPLOYMENT.md.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3, HTTPProvider
import solcx


REPO = Path(__file__).resolve().parents[1]
KEYS_FILE = REPO / "keys.json"
ENV_OUT = REPO / ".env.mainnet"
DEPLOY_DOC = REPO / "MAINNET_DEPLOYMENT.md"

RPC_URL = "https://evmrpc.0g.ai"
CHAIN_ID = 16661
EXPLORER = "https://chainscan.0g.ai"
SOLC_VERSION = "0.8.24"
PRIORITY_FEE_WEI = 2_500_000_000  # 2.5 Gwei (0G floor is 2 Gwei)

CONTRACTS_DIR = REPO / "contracts"
POOL_INFT_ARTIFACT = CONTRACTS_DIR / "out" / "PoolINFT.sol" / "PoolINFT.json"
MOCK_USDC_SRC = CONTRACTS_DIR / "src" / "MockUSDC.sol"
OZ_REMAP = "@openzeppelin/=lib/openzeppelin-contracts/"


def load_deployer() -> Account:
    if not KEYS_FILE.exists():
        sys.exit(f"keys.json missing at {KEYS_FILE}")
    data = json.loads(KEYS_FILE.read_text())
    acct = Account.from_key(data["privateKey"])
    print(f"  deployer: {acct.address}")
    return acct


def w3_connect() -> Web3:
    w3 = Web3(HTTPProvider(RPC_URL, request_kwargs={"timeout": 60}))
    assert w3.is_connected(), f"cannot reach {RPC_URL}"
    cid = w3.eth.chain_id
    assert cid == CHAIN_ID, f"wrong chain: got {cid}, want {CHAIN_ID}"
    return w3


def send(w3: Web3, acct: Account, tx: dict, *, label: str) -> dict:
    block = w3.eth.get_block("latest")
    base = block["baseFeePerGas"]
    # Use "pending" so we don't collide with anything already in the mempool
    # for this account (0G mainnet's RPC sometimes reports a lower confirmed
    # nonce than pending while txs are still propagating).
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
            print(f"  estimate_gas failed for {label}: {e!r}; using 4M")
            tx["gas"] = 4_000_000
    signed = acct.sign_transaction(tx)
    print(f"  → {label}  nonce={tx['nonce']}  gas={tx['gas']:,}")
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h, timeout=180)
    status = "ok" if r["status"] == 1 else "REVERTED"
    print(f"  ← {label}  {status}  tx={h.hex()}  block={r['blockNumber']}  gas_used={r['gasUsed']:,}")
    if r["status"] != 1:
        raise RuntimeError(f"{label} reverted")
    return {"tx_hash": "0x" + h.hex().removeprefix("0x"), "receipt": r}


def compile_mock_usdc() -> dict:
    print("  compiling MockUSDC.sol (solc 0.8.24)...")
    solcx.install_solc(SOLC_VERSION, show_progress=False)
    src = MOCK_USDC_SRC.read_text()
    out = solcx.compile_standard(
        {
            "language": "Solidity",
            "sources": {"MockUSDC.sol": {"content": src}},
            "settings": {
                "remappings": [OZ_REMAP],
                "optimizer": {"enabled": True, "runs": 200},
                "outputSelection": {"*": {"*": ["abi", "evm.bytecode"]}},
            },
        },
        solc_version=SOLC_VERSION,
        allow_paths=[str(CONTRACTS_DIR)],
        base_path=str(CONTRACTS_DIR),
    )
    c = out["contracts"]["MockUSDC.sol"]["MockUSDC"]
    return {"abi": c["abi"], "bytecode": c["evm"]["bytecode"]["object"]}


def load_poolinft_artifact() -> dict:
    d = json.loads(POOL_INFT_ARTIFACT.read_text())
    bc = d["bytecode"]
    return {
        "abi": d["abi"],
        "bytecode": bc["object"] if isinstance(bc, dict) else bc,
    }


def deploy_contract(
    w3: Web3, acct: Account, *, artifact: dict, args: list, label: str
) -> dict:
    c = w3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    tx = c.constructor(*args).build_transaction({"from": acct.address})
    tx.pop("nonce", None)
    tx.pop("chainId", None)
    tx.pop("maxFeePerGas", None)
    tx.pop("maxPriorityFeePerGas", None)
    tx.pop("type", None)
    result = send(w3, acct, tx, label=f"deploy {label}")
    addr = result["receipt"]["contractAddress"]
    print(f"  {label} @ {addr}")
    return {"address": addr, "tx_hash": result["tx_hash"], "abi": artifact["abi"]}


def env_lines(d: dict[str, str]) -> str:
    return "\n".join(f"{k}={v}" for k, v in d.items()) + "\n"


def write_env_mainnet(out: dict) -> None:
    addrs = out["addresses"]
    body = f"""# =====================================================================
# 0G MAINNET — chainId 16661 — RPC https://evmrpc.0g.ai
# Auto-written by scripts/deploy_mainnet.py at {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
# Do not commit this file. Operator keys are intentionally left as TODO stubs;
# only keys.json signs deploys for now.
# =====================================================================

MONGODB_DB=computepool

# Chain
SEPOLIA_RPC_URL={RPC_URL}
CHAIN_ID={CHAIN_ID}
ZERO_G_CHAIN_RPC={RPC_URL}
ZERO_G_CHAIN_ID={CHAIN_ID}

# Tokens
USDC_ADDRESS={addrs.get('MockUSDC', 'TBD')}
USDCX_ADDRESS={addrs.get('USDCx', 'TBD')}

# Superfluid forwarders (deploy in a separate phase; TBD until that phase lands)
CFA_V1_FORWARDER={addrs.get('CFAv1Forwarder', '0x0000000000000000000000000000000000000000')}
GDA_V1_FORWARDER={addrs.get('GDAv1Forwarder', '0x0000000000000000000000000000000000000000')}

# Coalition — disabled on mainnet (no source in repo)
COALITION_ENABLED=false
COALITION_ADDRESS=0x0000000000000000000000000000000000000000

# Orchestrator wallet — TODO: set to a fresh mainnet key before running orchestrator
ORCHESTRATOR_WALLET_ADDRESS=0x0000000000000000000000000000000000000001
ORCHESTRATOR_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001

# Faucet — TODO: set to MockUSDC owner key (currently keys.json deployer)
FAUCET_PRIVATE_KEY=

# x402
RELAYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
X402_FACILITATOR_URL=http://facilitator:4021
X402_DEFAULT_PRICE_PER_TOKEN_USDC_MICRO=100

# KeeperHub — disabled until mainnet workflows exist
KEEPERHUB_API_KEY=
KEEPERHUB_BASE_URL=https://app.keeperhub.com
KEEPERHUB_WEBHOOK_SECRET=
KH_WORKFLOW_COALITION_FORM=
KH_WORKFLOW_ACTIVATE_AND_POOL=
KH_WORKFLOW_SET_MEMBER_UNITS=
KH_WORKFLOW_STREAM_START=
KH_WORKFLOW_STREAM_STOP=
KH_WORKFLOW_HANDLE_BREACH=

PUBLIC_URL=https://example.invalid

# Worker keys — TODO
WORKER_A_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
WORKER_B_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001

# Demo payer — TODO
DEMO_PAYER_KEY=0x0000000000000000000000000000000000000000000000000000000000000001

# Misc
OWNER_API_KEY={os.urandom(24).hex()}
MODEL_NAME=Qwen/Qwen2.5-3B-Instruct
CP_OPENAI_AUTH_DEV_PASSTHROUGH=1

# PoolINFT — deployed on mainnet
INFT_CONTRACT_ADDR={addrs.get('PoolINFT', 'TBD')}
INFT_ORACLE_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
"""
    ENV_OUT.write_text(body)
    print(f"  wrote {ENV_OUT}")


def write_deployment_md(out: dict) -> None:
    addrs = out["addresses"]
    txs = out["txs"]
    deployer = out["deployer"]
    lines = [
        "# ComputePool — 0G Mainnet Deployment\n",
        f"- **Chain:** 0G mainnet (chainId {CHAIN_ID})",
        f"- **RPC:** {RPC_URL}",
        f"- **Explorer:** {EXPLORER}",
        f"- **Deployer:** [`{deployer}`]({EXPLORER}/address/{deployer})",
        f"- **Generated:** {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n",
        "## Deployed contracts\n",
        "| Contract | Address | Deploy tx |",
        "|---|---|---|",
    ]
    for name, addr in addrs.items():
        deploy_tx = txs.get(f"deploy_{name}", "")
        tx_md = f"[`{deploy_tx}`]({EXPLORER}/tx/{deploy_tx})" if deploy_tx else "—"
        lines.append(f"| {name} | [`{addr}`]({EXPLORER}/address/{addr}) | {tx_md} |")
    lines.append("\n## Demo transactions\n")
    lines.append("| Action | Tx |")
    lines.append("|---|---|")
    for k, v in txs.items():
        if k.startswith("deploy_"):
            continue
        lines.append(f"| {k} | [`{v}`]({EXPLORER}/tx/{v}) |")
    DEPLOY_DOC.write_text("\n".join(lines) + "\n")
    print(f"  wrote {DEPLOY_DOC}")


def phase_poolinft(w3: Web3, acct: Account, out: dict) -> None:
    print("\n=== phase: poolinft ===")
    art = load_poolinft_artifact()
    # Oracle = deployer (rotate later via setOracle if needed)
    res = deploy_contract(w3, acct, artifact=art, args=[acct.address], label="PoolINFT")
    out["addresses"]["PoolINFT"] = res["address"]
    out["abis"]["PoolINFT"] = res["abi"]
    out["txs"]["deploy_PoolINFT"] = res["tx_hash"]


def phase_usdc(w3: Web3, acct: Account, out: dict, *, skip_deploy: bool = False) -> None:
    print("\n=== phase: usdc ===")
    if skip_deploy:
        print(f"  reusing MockUSDC @ {out['addresses']['MockUSDC']}")
        abi = out["abis"]["MockUSDC"]
    else:
        art = compile_mock_usdc()
        res = deploy_contract(w3, acct, artifact=art, args=[], label="MockUSDC")
        out["addresses"]["MockUSDC"] = res["address"]
        out["abis"]["MockUSDC"] = res["abi"]
        out["txs"]["deploy_MockUSDC"] = res["tx_hash"]
        abi = res["abi"]

    usdc = w3.eth.contract(address=out["addresses"]["MockUSDC"], abi=abi)
    mint_amt = 1_000_000 * 10**6  # 1M USDC (6 decimals)
    tx = usdc.functions.mint(acct.address, mint_amt).build_transaction({"from": acct.address})
    tx.pop("nonce", None); tx.pop("chainId", None); tx.pop("maxFeePerGas", None)
    tx.pop("maxPriorityFeePerGas", None); tx.pop("type", None)
    mr = send(w3, acct, tx, label="USDC.mint(1,000,000)")
    out["txs"]["mint_1m_usdc"] = mr["tx_hash"]

    bal = usdc.functions.balanceOf(acct.address).call()
    print(f"  deployer USDC balance: {bal / 1e6:,.2f}")


def phase_demo(w3: Web3, acct: Account, out: dict) -> None:
    print("\n=== phase: demo ===")
    # 1) PoolINFT.mint a demo token
    inft_addr = out["addresses"]["PoolINFT"]
    inft = w3.eth.contract(address=inft_addr, abi=out["abis"]["PoolINFT"])
    metadata_hash = Web3.keccak(text="computepool-mainnet-demo-pool-1")
    metadata_uri = "0g://mainnet-demo-pool-1"
    sealed_key = b"\x00" * 32  # placeholder; in prod this is ECIES(holder_pubkey, AES_key)
    tx = inft.functions.mint(
        acct.address, metadata_hash, metadata_uri, sealed_key
    ).build_transaction({"from": acct.address})
    tx.pop("nonce", None); tx.pop("chainId", None); tx.pop("maxFeePerGas", None)
    tx.pop("maxPriorityFeePerGas", None); tx.pop("type", None)
    mr = send(w3, acct, tx, label="PoolINFT.mint")
    out["txs"]["inft_mint"] = mr["tx_hash"]

    # 2) USDC.transferWithAuthorization (EIP-3009) — signed off-chain, broadcast by anyone
    usdc_addr = out["addresses"]["MockUSDC"]
    usdc = w3.eth.contract(address=usdc_addr, abi=out["abis"]["MockUSDC"])
    recipient = Account.create()  # ephemeral recipient
    value = 10 * 10**6  # 10 USDC
    now = int(time.time())
    valid_after = now - 60
    valid_before = now + 3600
    nonce_bytes = os.urandom(32)

    domain = {
        "name": "USD Coin",
        "version": "2",
        "chainId": CHAIN_ID,
        "verifyingContract": usdc_addr,
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
        "from": acct.address,
        "to": recipient.address,
        "value": value,
        "validAfter": valid_after,
        "validBefore": valid_before,
        "nonce": nonce_bytes,
    }
    typed = {"types": types, "primaryType": "TransferWithAuthorization", "domain": domain, "message": message}
    signable = encode_typed_data(full_message=typed)
    sig = acct.sign_message(signable)

    tx = usdc.functions.transferWithAuthorization(
        acct.address, recipient.address, value, valid_after, valid_before,
        nonce_bytes, sig.v, sig.r.to_bytes(32, "big"), sig.s.to_bytes(32, "big"),
    ).build_transaction({"from": acct.address})
    tx.pop("nonce", None); tx.pop("chainId", None); tx.pop("maxFeePerGas", None)
    tx.pop("maxPriorityFeePerGas", None); tx.pop("type", None)
    mr = send(w3, acct, tx, label="USDC.transferWithAuthorization")
    out["txs"]["x402_eip3009_settle"] = mr["tx_hash"]

    recv_bal = usdc.functions.balanceOf(recipient.address).call()
    print(f"  recipient ({recipient.address}) received: {recv_bal / 1e6} USDC")


STATE_FILE = REPO / ".mainnet_state.json"


def save_state(out: dict) -> None:
    persist = {k: v for k, v in out.items() if k != "abis"}
    STATE_FILE.write_text(json.dumps(persist, indent=2))


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--phase", choices=["poolinft", "usdc", "demo", "all"], default="all"
    )
    p.add_argument("--resume", action="store_true",
                   help="Load .mainnet_state.json and skip phases whose contracts are already deployed.")
    args = p.parse_args()

    print(f"=== ComputePool mainnet deploy → {RPC_URL} (chainId {CHAIN_ID}) ===")
    acct = load_deployer()
    w3 = w3_connect()
    bal = w3.eth.get_balance(acct.address)
    print(f"  deployer balance: {bal / 1e18:.4f} OG")
    if bal < 10**17:
        sys.exit("deployer balance too low (<0.1 OG)")

    out: dict[str, Any] = {
        "deployer": acct.address,
        "addresses": {},
        "txs": {},
        "abis": {},
    }
    if args.resume:
        prior = load_state()
        out["addresses"].update(prior.get("addresses", {}))
        out["txs"].update(prior.get("txs", {}))
        # Rehydrate ABIs from artifact + recompile
        if "PoolINFT" in out["addresses"]:
            out["abis"]["PoolINFT"] = load_poolinft_artifact()["abi"]
        if "MockUSDC" in out["addresses"]:
            out["abis"]["MockUSDC"] = compile_mock_usdc()["abi"]
        print(f"  resumed with addresses: {list(out['addresses'].keys())}")

    phases = [args.phase] if args.phase != "all" else ["poolinft", "usdc", "demo"]
    for ph in phases:
        if ph == "poolinft":
            if args.resume and "PoolINFT" in out["addresses"]:
                print("\n=== phase: poolinft (skipped, already deployed) ===")
                continue
            phase_poolinft(w3, acct, out)
            save_state(out)
        elif ph == "usdc":
            if args.resume and "MockUSDC" in out["addresses"] and "mint_1m_usdc" in out["txs"]:
                print("\n=== phase: usdc (skipped, already done) ===")
                continue
            phase_usdc(w3, acct, out, skip_deploy=args.resume and "MockUSDC" in out["addresses"])
            save_state(out)
        elif ph == "demo":
            phase_demo(w3, acct, out)
            save_state(out)

    save_state(out)
    print(f"\n  wrote {STATE_FILE}")

    write_env_mainnet(out)
    write_deployment_md(out)

    print(f"\nDone. Final balance: {w3.eth.get_balance(acct.address) / 1e18:.4f} OG")


if __name__ == "__main__":
    main()
