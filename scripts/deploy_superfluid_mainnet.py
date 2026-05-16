"""Deploy the Superfluid framework to 0G mainnet via the upstream
SuperfluidFrameworkDeployer (npm: @superfluid-finance/ethereum-contracts).

Strategy:
    1. Deploy each Solidity library that the framework deployer needs.
    2. Link library addresses into the deployer's bytecode (replacing
       `__LibName______` placeholders with the deployed addresses).
    3. Deploy SuperfluidFrameworkDeployer.
    4. Loop `executeStep(i)` for every step (the deployer chunks framework
       deployment into N steps to stay under chain block-gas limits).
    5. Call `getFramework()` and persist all 14 addresses.
    6. Use SuperTokenFactory.createERC20Wrapper to wrap MockUSDC → USDCx.
    7. Run a small demo: USDC.approve → USDCx.upgrade → GDA createPool →
       updateMemberUnits → distributeFlow (start + stop). All txs land on
       MAINNET_DEPLOYMENT.md.

Run:
    source .venv/bin/activate
    python scripts/deploy_superfluid_mainnet.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

from eth_account import Account
from web3 import Web3, HTTPProvider


REPO = Path(__file__).resolve().parents[1]
KEYS = REPO / "keys.json"
STATE = REPO / ".mainnet_state.json"
DEPLOY_DOC = REPO / "MAINNET_DEPLOYMENT.md"

RPC_URL = "https://evmrpc.0g.ai"
CHAIN_ID = 16661
EXPLORER = "https://chainscan.0g.ai"
PRIORITY_FEE_WEI = 2_500_000_000

SF_ARTIFACTS = Path("/tmp/sf-pkg/node_modules/@superfluid-finance/ethereum-contracts/build/truffle")

# Libraries the framework deployer links against, in dependency order
# (those without sub-deps first; SlotsBitmap / PoolDeployer before IDA/GDA).
LIBRARY_ORDER = [
    "SlotsBitmapLibrary",
    "SuperfluidPoolDeployerLibrary",
    "SuperfluidGovDeployerLibrary",
    "SuperfluidHostDeployerLibrary",
    "SuperfluidCFAv1DeployerLibrary",
    "SuperfluidIDAv1DeployerLibrary",
    "SuperfluidGDAv1DeployerLibrary",
    "SuperfluidPoolLogicDeployerLibrary",
    "SuperTokenDeployerLibrary",
    "SuperTokenFactoryDeployerLibrary",
    "CFAv1ForwarderDeployerLibrary",
    "GDAv1ForwarderDeployerLibrary",
    "SuperfluidPeripheryDeployerLibrary",
    "ProxyDeployerLibrary",
    "TokenDeployerLibrary",
]

# Map library short-name → placeholder pattern in bytecode.
# Truffle pads to a 38-char name (40 chars including leading/trailing `__`),
# truncating from the right.
def placeholder_for(name: str) -> str:
    body = name[:36].ljust(36, "_")
    return f"__{body}__"


def w3_connect() -> Web3:
    w3 = Web3(HTTPProvider(RPC_URL, request_kwargs={"timeout": 90}))
    assert w3.eth.chain_id == CHAIN_ID
    return w3


def send(w3: Web3, acct: Account, tx: dict, *, label: str, gas_default: int = 3_000_000) -> dict:
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
    # 0G mainnet's eth_estimateGas rejects integer "type" fields. Try estimate
    # without type for accuracy; if that still fails, use gas_default.
    if "gas" not in tx:
        est_tx = {k: v for k, v in tx.items() if k not in ("type", "chainId")}
        try:
            tx["gas"] = int(w3.eth.estimate_gas(est_tx) * 13 // 10)
        except Exception as e:
            print(f"    estimate_gas failed for {label}: {e!r}; defaulting to {gas_default:,}")
            tx["gas"] = gas_default
    signed = acct.sign_transaction(tx)
    print(f"    → {label}  nonce={tx['nonce']}  gas={tx['gas']:,}")
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h, timeout=300)
    status = "ok" if r["status"] == 1 else "REVERTED"
    print(f"    ← {label}  {status}  tx={h.hex()}  block={r['blockNumber']}  gas_used={r['gasUsed']:,}")
    if r["status"] != 1:
        raise RuntimeError(f"{label} reverted; tx=0x{h.hex().removeprefix('0x')}")
    return {"tx_hash": "0x" + h.hex().removeprefix("0x"), "receipt": r}


def load_artifact(name: str) -> dict:
    return json.loads((SF_ARTIFACTS / f"{name}.json").read_text())


def link_bytecode(bc: str, links: dict[str, str]) -> str:
    """Replace `__LibName______` placeholders with deployed addresses (no 0x)."""
    for name, addr in links.items():
        ph = placeholder_for(name)
        clean = addr.lower().removeprefix("0x")
        assert len(clean) == 40, f"bad addr for {name}: {addr}"
        if ph in bc:
            bc = bc.replace(ph, clean)
    # Sanity: no placeholders left
    leftover = re.findall(r"__[A-Za-z0-9_$]{36,38}__", bc)
    assert not leftover, f"unlinked placeholders: {set(leftover)}"
    return bc


def deploy_raw(w3: Web3, acct: Account, *, bytecode: str, label: str, gas_default: int = 5_000_000) -> str:
    tx = {"data": bytecode}
    r = send(w3, acct, tx, label=f"deploy {label}", gas_default=gas_default)
    addr = r["receipt"]["contractAddress"]
    code = w3.eth.get_code(addr)
    print(f"      {label} @ {addr}  code_size={len(code)}B")
    return addr


def deploy_libraries(w3: Web3, acct: Account, *, existing: dict[str, str] | None = None) -> dict[str, str]:
    """Deploy all libraries (linking transitive deps as we go).

    If `existing` is provided, libraries already in it are skipped (resume mode).
    """
    print("\n── 1) deploy libraries ──")
    out: dict[str, str] = dict(existing or {})
    for name in LIBRARY_ORDER:
        if name in out:
            print(f"  reusing {name} @ {out[name]}")
            continue
        try:
            art = load_artifact(name)
        except FileNotFoundError:
            print(f"  skipping {name}: artifact missing")
            continue
        bc = art["bytecode"]
        if re.search(r"__[A-Za-z0-9_$]{36,38}__", bc):
            bc = link_bytecode(bc, out)
        # Size-aware gas budget: 200 gas/byte storage + 32k constructor headroom
        bytecode_bytes = len(bc.removeprefix("0x")) // 2
        gas_budget = max(2_500_000, bytecode_bytes * 250 + 200_000)
        addr = deploy_raw(w3, acct, bytecode=bc, label=name, gas_default=gas_budget)
        out[name] = addr
    return out


def deploy_framework_deployer(w3: Web3, acct: Account, links: dict[str, str]) -> tuple[str, list]:
    print("\n── 2) deploy SuperfluidFrameworkDeployer ──")
    art = load_artifact("SuperfluidFrameworkDeployer")
    bc = link_bytecode(art["bytecode"], links)
    addr = deploy_raw(w3, acct, bytecode=bc, label="SuperfluidFrameworkDeployer", gas_default=8_000_000)
    return addr, art["abi"]


def run_framework_deploy_steps(w3: Web3, acct: Account, deployer_addr: str, abi: list) -> None:
    print("\n── 3) executeStep loop ──")
    deployer = w3.eth.contract(address=deployer_addr, abi=abi)
    n = deployer.functions.getNumSteps().call()
    print(f"    framework deployer has {n} steps")
    for i in range(n):
        fn = deployer.functions.executeStep(i)
        tx = fn.build_transaction({"from": acct.address})
        for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
            tx.pop(k, None)
        send(w3, acct, tx, label=f"executeStep({i})", gas_default=10_000_000)


def read_framework_addresses(w3: Web3, deployer_addr: str, abi: list) -> dict[str, str]:
    deployer = w3.eth.contract(address=deployer_addr, abi=abi)
    sf = deployer.functions.getFramework().call()
    keys = [
        "governance", "host", "cfa", "ida", "gda", "superTokenFactory",
        "superTokenLogic", "resolver", "superfluidLoader",
        "cfaV1Forwarder", "gdaV1Forwarder", "macroForwarder",
        "batchLiquidator", "toga",
    ]
    return dict(zip(keys, sf))


def deploy_usdcx_wrapper(w3: Web3, acct: Account, *, usdc_addr: str, factory_addr: str) -> str:
    print("\n── 4) wrap MockUSDC → USDCx via SuperTokenFactory ──")
    factory_art = load_artifact("SuperTokenFactory")
    factory = w3.eth.contract(address=factory_addr, abi=factory_art["abi"])

    # createERC20Wrapper signature varies across SF versions; we discover from ABI.
    create_fn = None
    for f in factory_art["abi"]:
        if f.get("name") == "createERC20Wrapper" and f.get("type") == "function":
            ins = [i["type"] for i in f["inputs"]]
            create_fn = (f, ins)
            break
    assert create_fn, "createERC20Wrapper not in SuperTokenFactory ABI"
    fn_info, ins = create_fn
    print(f"    using createERC20Wrapper({','.join(ins)})")

    # 1.6.0+ has: createERC20Wrapper(IERC20Metadata, Upgradability, string, string)
    #   underlying, upgradability (uint8 enum: 0=non, 1=semi, 2=full), name, symbol
    upgradability = 0  # NON_UPGRADABLE (deployer is the owner; we can redeploy if needed)
    name = "Super USDC"
    symbol = "USDCx"
    # 6 decimals on the underlying; the wrapper internally uses 18 dp and exposes upgrade/downgrade.
    if len(ins) == 4:
        call = factory.functions.createERC20Wrapper(
            w3.to_checksum_address(usdc_addr), upgradability, name, symbol
        )
    elif len(ins) == 5:
        # Older: (IERC20, uint8 underlyingDecimals, Upgradability, name, symbol)
        call = factory.functions.createERC20Wrapper(
            w3.to_checksum_address(usdc_addr), 6, upgradability, name, symbol
        )
    else:
        raise RuntimeError(f"unexpected createERC20Wrapper arity: {ins}")

    tx = call.build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label="SuperTokenFactory.createERC20Wrapper(USDC)", gas_default=6_000_000)

    # Find the new SuperToken address from the SuperTokenCreated event
    usdcx = None
    for log in r["receipt"].get("logs", []):
        # Event signature: SuperTokenCreated(address token)
        # topic[0] = keccak("SuperTokenCreated(address)")
        sig = w3.keccak(text="SuperTokenCreated(address)").hex()
        if not log["topics"]:
            continue
        if log["topics"][0].hex().removeprefix("0x") == sig.removeprefix("0x"):
            usdcx = w3.to_checksum_address("0x" + log["topics"][1].hex()[-40:])
            break
    if usdcx is None:
        # Fallback: brute-force decode through ABI
        try:
            evt = factory.events.SuperTokenCreated()
            for log in r["receipt"].get("logs", []):
                try:
                    d = evt.process_log(log)
                    usdcx = d["args"]["token"]
                    break
                except Exception:
                    continue
        except Exception:
            pass
    assert usdcx is not None, "could not locate USDCx address in createERC20Wrapper logs"
    print(f"      USDCx @ {usdcx}")
    return usdcx


def superfluid_demo(w3: Web3, acct: Account, *, usdc_addr: str, usdcx_addr: str, gda_forwarder_addr: str) -> dict[str, str]:
    print("\n── 5) Superfluid demo (upgrade, createPool, distributeFlow) ──")
    usdc_abi = json.loads("""[
      {"name":"approve","type":"function","stateMutability":"nonpayable",
       "inputs":[{"name":"s","type":"address"},{"name":"v","type":"uint256"}],
       "outputs":[{"type":"bool"}]},
      {"name":"balanceOf","type":"function","stateMutability":"view",
       "inputs":[{"name":"a","type":"address"}],"outputs":[{"type":"uint256"}]}
    ]""")
    usdcx_abi = json.loads("""[
      {"name":"upgrade","type":"function","stateMutability":"nonpayable",
       "inputs":[{"name":"amount","type":"uint256"}],"outputs":[]},
      {"name":"balanceOf","type":"function","stateMutability":"view",
       "inputs":[{"name":"a","type":"address"}],"outputs":[{"type":"uint256"}]}
    ]""")
    gda_abi = load_artifact("GDAv1Forwarder")["abi"]

    usdc = w3.eth.contract(address=usdc_addr, abi=usdc_abi)
    usdcx = w3.eth.contract(address=usdcx_addr, abi=usdcx_abi)
    gda = w3.eth.contract(address=gda_forwarder_addr, abi=gda_abi)

    out: dict[str, str] = {}

    # 5a) Approve & upgrade 100 USDC → 100 USDCx
    upgrade_amount_underlying = 100 * 10**6  # 100 USDC (6 dp)
    # SuperToken expects 18-dp value for upgrade; SF internally scales.
    upgrade_amount_18 = 100 * 10**18

    tx = usdc.functions.approve(usdcx_addr, upgrade_amount_underlying).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    out["usdc_approve_usdcx"] = send(w3, acct, tx, label="USDC.approve(USDCx, 100)")["tx_hash"]

    tx = usdcx.functions.upgrade(upgrade_amount_18).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    out["usdcx_upgrade_100"] = send(w3, acct, tx, label="USDCx.upgrade(100)")["tx_hash"]
    bal = usdcx.functions.balanceOf(acct.address).call()
    print(f"      USDCx balance: {bal/1e18:.4f}")

    # 5b) Create a GDA pool
    tx = gda.functions.createPool(
        w3.to_checksum_address(usdcx_addr),
        acct.address,
        (False, False),
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label="GDAv1Forwarder.createPool(USDCx, admin)", gas_default=3_500_000)
    out["gda_create_pool"] = r["tx_hash"]
    # Decode the pool address by replaying the call via eth_call
    tx_obj = w3.eth.get_transaction(r["tx_hash"])
    raw = w3.eth.call({"from": tx_obj["from"], "to": tx_obj["to"], "data": tx_obj["input"]}, tx_obj["blockNumber"] - 1)
    pool_addr = w3.to_checksum_address("0x" + raw.hex()[88:128])  # ABI-packed (bool, address)
    print(f"      GDA pool @ {pool_addr}")
    out["gda_pool_address"] = pool_addr

    # 5c) Add a member to the pool with units=1
    member = Account.create()
    tx = gda.functions.updateMemberUnits(
        w3.to_checksum_address(pool_addr), member.address, 1, b"",
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    out["gda_update_member_units"] = send(w3, acct, tx, label=f"GDA.updateMemberUnits({member.address}, 1)")["tx_hash"]

    # 5d) Start a flow: 1e12 wei/sec USDCx into the pool (~ 0.0036 USDCx/hour)
    flow_rate = 10**12  # wei/sec
    tx = gda.functions.distributeFlow(
        w3.to_checksum_address(usdcx_addr),
        acct.address,
        w3.to_checksum_address(pool_addr),
        flow_rate,
        b"",
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    out["gda_distribute_flow_start"] = send(w3, acct, tx, label=f"GDA.distributeFlow(rate={flow_rate})", gas_default=3_500_000)["tx_hash"]

    # 5e) Wait 20s so the stream accrues, then stop.
    print("      sleeping 20s to let the stream accrue...")
    time.sleep(20)

    tx = gda.functions.distributeFlow(
        w3.to_checksum_address(usdcx_addr),
        acct.address,
        w3.to_checksum_address(pool_addr),
        0,
        b"",
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    out["gda_distribute_flow_stop"] = send(w3, acct, tx, label="GDA.distributeFlow(rate=0)", gas_default=3_500_000)["tx_hash"]

    return out


def append_to_deployment_doc(extra: dict) -> None:
    doc = DEPLOY_DOC.read_text()
    # Drop the old "Superfluid framework — NOT deployed" section if present.
    doc = re.sub(
        r"\n## Superfluid framework — NOT deployed.*?(?=\n## |\Z)",
        "",
        doc,
        flags=re.DOTALL,
    )
    fw = extra["framework"]
    block = ["\n## Superfluid framework — DEPLOYED ✅\n",
             "Single-tx framework deploy via `SuperfluidFrameworkDeployer` from upstream `@superfluid-finance/ethereum-contracts`. Libraries linked, framework steps executed sequentially.\n",
             "| Component | Address |",
             "|---|---|"]
    for k, v in fw.items():
        block.append(f"| {k} | [`{v}`]({EXPLORER}/address/{v}) |")
    block.append("")
    block.append("**Linked libraries**\n")
    block.append("| Library | Address |")
    block.append("|---|---|")
    for k, v in extra["libraries"].items():
        block.append(f"| {k} | [`{v}`]({EXPLORER}/address/{v}) |")
    block.append("")
    block.append(f"**SuperfluidFrameworkDeployer** — [`{extra['framework_deployer']}`]({EXPLORER}/address/{extra['framework_deployer']})")
    block.append("")
    block.append("## Superfluid USDCx + GDA demo\n")
    block.append("| Action | Tx |")
    block.append("|---|---|")
    label_map = {
        "usdc_approve_usdcx": "USDC.approve(USDCx, 100)",
        "usdcx_upgrade_100": "USDCx.upgrade(100) — wrap 100 USDC → USDCx",
        "gda_create_pool": "GDAv1Forwarder.createPool(USDCx, admin)",
        "gda_update_member_units": "GDA.updateMemberUnits(member, 1)",
        "gda_distribute_flow_start": "GDA.distributeFlow rate=1e12 wei/s (stream START)",
        "gda_distribute_flow_stop": "GDA.distributeFlow rate=0 (stream STOP after ~20s)",
    }
    for k, label in label_map.items():
        v = extra["demo_txs"].get(k)
        if v:
            block.append(f"| {label} | [`{v}`]({EXPLORER}/tx/{v}) |")
    block.append(f"\n**USDCx pool address:** [`{extra['demo_txs']['gda_pool_address']}`]({EXPLORER}/address/{extra['demo_txs']['gda_pool_address']})\n")
    DEPLOY_DOC.write_text(doc.rstrip() + "\n" + "\n".join(block) + "\n")
    print(f"  appended Superfluid section to {DEPLOY_DOC}")


def main() -> None:
    print(f"=== Superfluid framework deploy → {RPC_URL} (chainId {CHAIN_ID}) ===")
    state = json.loads(STATE.read_text())
    usdc_addr = state["addresses"]["MockUSDC"]
    print(f"  MockUSDC: {usdc_addr}")

    acct = Account.from_key(json.loads(KEYS.read_text())["privateKey"])
    w3 = w3_connect()
    bal = w3.eth.get_balance(acct.address)
    print(f"  deployer: {acct.address}  balance: {bal/1e18:.4f} OG")
    if bal < 5 * 10**17:
        sys.exit("low balance (<0.5 OG); aborting")

    # 1) Libraries — resume from any prior partial deploy
    prior_libs = state.get("superfluid", {}).get("libraries", {})
    libs = deploy_libraries(w3, acct, existing=prior_libs)
    state.setdefault("superfluid", {})["libraries"] = libs
    STATE.write_text(json.dumps(state, indent=2))

    # 2) Framework deployer
    fwd_addr, fwd_abi = deploy_framework_deployer(w3, acct, libs)
    state["superfluid"]["framework_deployer"] = fwd_addr
    STATE.write_text(json.dumps(state, indent=2))

    # 3) executeStep loop
    run_framework_deploy_steps(w3, acct, fwd_addr, fwd_abi)

    # 4) Read framework
    fw = read_framework_addresses(w3, fwd_addr, fwd_abi)
    state["superfluid"]["framework"] = fw
    STATE.write_text(json.dumps(state, indent=2))
    print("\n  framework:")
    for k, v in fw.items():
        print(f"    {k:>20s} = {v}")

    # 5) USDCx
    usdcx = deploy_usdcx_wrapper(w3, acct, usdc_addr=usdc_addr, factory_addr=fw["superTokenFactory"])
    state["addresses"]["USDCx"] = usdcx
    STATE.write_text(json.dumps(state, indent=2))

    # 6) Demo
    demo = superfluid_demo(w3, acct, usdc_addr=usdc_addr, usdcx_addr=usdcx, gda_forwarder_addr=fw["gdaV1Forwarder"])
    state["txs"].update(demo)
    STATE.write_text(json.dumps(state, indent=2))

    # 7) Update markdown
    append_to_deployment_doc({
        "libraries": libs,
        "framework_deployer": fwd_addr,
        "framework": fw,
        "demo_txs": demo,
    })

    final = w3.eth.get_balance(acct.address) / 1e18
    print(f"\nDone. Final balance: {final:.4f} OG")


if __name__ == "__main__":
    main()
