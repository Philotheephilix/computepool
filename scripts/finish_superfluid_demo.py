"""Finish the manual Superfluid deploy from the partial state in .mainnet_state.json.

Steps:
    1. gov.updateContracts(host, 0, [], factoryImpl, 0)
       → host deploys its own UUPSProxy around the factory impl.
    2. Read the new factory address from host.getSuperTokenFactory().
    3. Deploy CFAv1Forwarder + GDAv1Forwarder (skipped if already present).
    4. factory.createERC20Wrapper(MockUSDC, NON_UPGRADABLE, "Super USDC", "USDCx")
    5. USDC.approve → USDCx.upgrade(100) → GDA.createPool → updateMemberUnits →
       distributeFlow start → sleep → distributeFlow stop.
    6. Persist everything to state and append to MAINNET_DEPLOYMENT.md.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

from eth_account import Account
from web3 import Web3, HTTPProvider


REPO = Path(__file__).resolve().parents[1]
STATE = REPO / ".mainnet_state.json"
DEPLOY_DOC = REPO / "MAINNET_DEPLOYMENT.md"
KEYS = REPO / "keys.json"
SF = Path("/tmp/sf-pkg/node_modules/@superfluid-finance/ethereum-contracts/build/truffle")

RPC_URL = "https://evmrpc.0g.ai"
CHAIN_ID = 16661
EXPLORER = "https://chainscan.0g.ai"
PRIORITY_FEE_WEI = 2_500_000_000


def load_artifact(name: str) -> dict:
    return json.loads((SF / f"{name}.json").read_text())


def send(w3: Web3, acct: Account, tx: dict, *, label: str, gas: int) -> dict:
    base = w3.eth.get_block("latest")["baseFeePerGas"]
    tx = {
        **tx,
        "chainId": CHAIN_ID,
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address, "pending"),
        "maxFeePerGas": base + PRIORITY_FEE_WEI + 1_000_000_000,
        "maxPriorityFeePerGas": PRIORITY_FEE_WEI,
        "type": 2,
        "gas": gas,
    }
    signed = acct.sign_transaction(tx)
    print(f"    → {label}  nonce={tx['nonce']}  gas={gas:,}")
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    r = w3.eth.wait_for_transaction_receipt(h, timeout=300)
    print(f"    ← {label}  {'ok' if r['status']==1 else 'REVERTED'}  tx={h.hex()}  gas_used={r['gasUsed']:,}")
    if r["status"] != 1:
        raise RuntimeError(f"{label} reverted")
    return {"tx_hash": "0x" + h.hex().removeprefix("0x"), "receipt": r}


def build(call, sender):
    tx = call.build_transaction({"from": sender})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    return tx


def deploy_artifact(w3: Web3, acct: Account, *, name: str, ctor_args: list, label: str | None = None) -> tuple[str, list]:
    art = load_artifact(name)
    c = w3.eth.contract(abi=art["abi"], bytecode=art["bytecode"])
    data = c.constructor(*ctor_args).build_transaction({"from": acct.address})["data"]
    bc_bytes = len(data) // 2
    g = int(bc_bytes * 260 + 300_000)
    r = send(w3, acct, {"data": data}, label=f"deploy {label or name}", gas=g)
    addr = r["receipt"]["contractAddress"]
    print(f"      {label or name} @ {addr}")
    return addr, art["abi"]


def main() -> None:
    state = json.loads(STATE.read_text())
    fw = state["superfluid"]["framework"]
    usdc_addr = state["addresses"]["MockUSDC"]

    acct = Account.from_key(json.loads(KEYS.read_text())["privateKey"])
    w3 = Web3(HTTPProvider(RPC_URL))
    bal0 = w3.eth.get_balance(acct.address) / 1e18
    print(f"deployer balance: {bal0:.4f} OG")

    gov_abi = load_artifact("TestGovernance")["abi"]
    host_abi = load_artifact("Superfluid")["abi"]
    factory_abi = load_artifact("SuperTokenFactory")["abi"]
    gda_fwd_abi = load_artifact("GDAv1Forwarder")["abi"]

    gov = w3.eth.contract(address=fw["governance"], abi=gov_abi)
    host = w3.eth.contract(address=fw["host"], abi=host_abi)

    txs: dict[str, str] = {}
    addrs: dict[str, str] = dict(fw)

    # ── 1) Register factory implementation with host via governance ────────
    print("\n── 1) gov.updateContracts(factoryImpl) ──")
    factory_impl = fw["superTokenFactoryImpl"]
    tx = build(
        gov.functions.updateContracts(
            fw["host"], "0x" + "00" * 20, [], factory_impl, "0x" + "00" * 20,
        ),
        acct.address,
    )
    txs["gov_register_factory"] = send(w3, acct, tx, label="Gov.updateContracts(factoryImpl)", gas=2_000_000)["tx_hash"]
    new_factory = host.functions.getSuperTokenFactory().call()
    print(f"    host.factory now: {new_factory}")
    addrs["superTokenFactoryProxy"] = new_factory
    factory = w3.eth.contract(address=new_factory, abi=factory_abi)

    # ── 2) Forwarders (deploy if not present) ────────────────────────────
    print("\n── 2) CFAv1Forwarder + GDAv1Forwarder ──")
    if "cfaV1Forwarder" not in fw or fw["cfaV1Forwarder"].startswith("0x000"):
        cfa_fwd, _ = deploy_artifact(w3, acct, name="CFAv1Forwarder", ctor_args=[fw["host"]], label="CFAv1Forwarder")
        addrs["cfaV1Forwarder"] = cfa_fwd
    else:
        cfa_fwd = fw["cfaV1Forwarder"]
        print(f"    reusing CFAv1Forwarder @ {cfa_fwd}")
    if "gdaV1Forwarder" not in fw or fw["gdaV1Forwarder"].startswith("0x000"):
        gda_fwd, _ = deploy_artifact(w3, acct, name="GDAv1Forwarder", ctor_args=[fw["host"]], label="GDAv1Forwarder")
        addrs["gdaV1Forwarder"] = gda_fwd
    else:
        gda_fwd = fw["gdaV1Forwarder"]
        print(f"    reusing GDAv1Forwarder @ {gda_fwd}")
    gda_forwarder = w3.eth.contract(address=gda_fwd, abi=gda_fwd_abi)

    # Authorize GDAv1Forwarder + CFAv1Forwarder as trusted on the host (so they can act on behalf of users).
    # Trusted-forwarder is a per-token config; pass address(0) for "all super tokens".
    for label, fwd in [("GDAv1Forwarder", gda_fwd), ("CFAv1Forwarder", cfa_fwd)]:
        tx = build(
            gov.functions.enableTrustedForwarder(fw["host"], "0x" + "00" * 20, fwd),
            acct.address,
        )
        send(w3, acct, tx, label=f"Gov.enableTrustedForwarder({label})", gas=300_000)

    state["superfluid"]["framework"] = addrs
    STATE.write_text(json.dumps(state, indent=2))

    # ── 3) Deploy USDCx via factory ─────────────────────────────────────
    # The 4-arg createERC20Wrapper requires the canonical-wrapper mapping
    # to be initialized (which the framework deployer normally does in a
    # separate post-deploy step). We use the 5-arg overload which routes
    # through FullUpgradableSuperTokenProxy and skips the canonical map.
    # Upgradability=2 (FULL_UPGRADABLE); decimals must match the underlying
    # USDC (6).
    print("\n── 3) USDCx via factory.createERC20Wrapper (5-arg, FULL_UPGRADABLE) ──")
    create_5arg = None
    for f in factory_abi:
        if f.get("name") == "createERC20Wrapper" and f.get("type") == "function":
            if len(f["inputs"]) == 5:
                create_5arg = f
                break
    assert create_5arg, "5-arg createERC20Wrapper not found"
    selector = w3.keccak(text="createERC20Wrapper(address,uint8,uint8,string,string)")[:4]
    from eth_abi import encode as abi_encode
    args_encoded = abi_encode(
        ["address", "uint8", "uint8", "string", "string"],
        [Web3.to_checksum_address(usdc_addr), 6, 2, "Super USDC", "USDCx"],
    )
    data = selector + args_encoded
    # Simulate first
    try:
        ret = w3.eth.call({"from": acct.address, "to": new_factory, "data": "0x" + data.hex()})
        print(f"    eth_call OK; would return {ret.hex()[:80]}")
    except Exception as e:
        print(f"    eth_call FAILED: {e}")
        raise

    r = send(w3, acct, {"to": new_factory, "data": "0x" + data.hex()},
             label="factory.createERC20Wrapper(USDC, 6, FULL_UPGRADABLE)", gas=6_000_000)
    txs["factory_create_usdcx"] = r["tx_hash"]
    # Find USDCx address from SuperTokenCreated event
    usdcx = None
    for log in r["receipt"]["logs"]:
        if not log["topics"]:
            continue
        sig = Web3.keccak(text="SuperTokenCreated(address)").hex()
        if log["topics"][0].hex().removeprefix("0x") == sig.removeprefix("0x"):
            usdcx = Web3.to_checksum_address("0x" + log["topics"][1].hex()[-40:])
            break
    assert usdcx, "did not find SuperTokenCreated"
    print(f"    USDCx @ {usdcx}")
    state["addresses"]["USDCx"] = usdcx
    STATE.write_text(json.dumps(state, indent=2))

    # ── 4) Demo: approve, upgrade, createPool, distributeFlow ────────────
    print("\n── 4) Demo flow ──")
    usdc = w3.eth.contract(
        address=usdc_addr,
        abi=json.loads("""[
          {"name":"approve","type":"function","stateMutability":"nonpayable",
           "inputs":[{"name":"s","type":"address"},{"name":"v","type":"uint256"}],
           "outputs":[{"type":"bool"}]},
          {"name":"balanceOf","type":"function","stateMutability":"view",
           "inputs":[{"name":"a","type":"address"}],"outputs":[{"type":"uint256"}]}
        ]"""),
    )
    usdcx_c = w3.eth.contract(address=usdcx, abi=load_artifact("SuperToken")["abi"])

    # 4a) approve
    tx = build(usdc.functions.approve(usdcx, 100 * 10**6), acct.address)
    txs["usdc_approve_usdcx"] = send(w3, acct, tx, label="USDC.approve(USDCx, 100)", gas=100_000)["tx_hash"]

    # 4b) upgrade 100 USDC → USDCx (18 dp internally)
    tx = build(usdcx_c.functions.upgrade(100 * 10**18), acct.address)
    txs["usdcx_upgrade_100"] = send(w3, acct, tx, label="USDCx.upgrade(100)", gas=500_000)["tx_hash"]
    bal_x = usdcx_c.functions.balanceOf(acct.address).call()
    print(f"      USDCx balance: {bal_x/1e18:.6f}")

    # 4c) GDA.createPool via forwarder
    tx = build(
        gda_forwarder.functions.createPool(usdcx, acct.address, (False, False)),
        acct.address,
    )
    r = send(w3, acct, tx, label="GDAv1Forwarder.createPool(USDCx, admin)", gas=4_000_000)
    txs["gda_create_pool"] = r["tx_hash"]
    tx_obj = w3.eth.get_transaction(r["tx_hash"])
    raw = w3.eth.call(
        {"from": tx_obj["from"], "to": tx_obj["to"], "data": tx_obj["input"]},
        tx_obj["blockNumber"] - 1,
    )
    pool_addr = Web3.to_checksum_address("0x" + raw.hex()[88:128])
    txs["gda_pool_address"] = pool_addr
    print(f"      pool @ {pool_addr}")

    # 4d) Add a member with units=1
    member = Account.create()
    tx = build(
        gda_forwarder.functions.updateMemberUnits(pool_addr, member.address, 1, b""),
        acct.address,
    )
    txs["gda_update_member_units"] = send(
        w3, acct, tx, label=f"GDA.updateMemberUnits({member.address}, 1)", gas=500_000,
    )["tx_hash"]

    # 4e) Start distributeFlow at 1e12 wei/sec
    flow_rate = 10**12
    tx = build(
        gda_forwarder.functions.distributeFlow(usdcx, acct.address, pool_addr, flow_rate, b""),
        acct.address,
    )
    txs["gda_distribute_flow_start"] = send(
        w3, acct, tx, label=f"GDA.distributeFlow(rate={flow_rate})", gas=3_000_000,
    )["tx_hash"]

    print("      sleeping 25s to accrue stream...")
    time.sleep(25)

    # 4f) Stop distributeFlow
    tx = build(
        gda_forwarder.functions.distributeFlow(usdcx, acct.address, pool_addr, 0, b""),
        acct.address,
    )
    txs["gda_distribute_flow_stop"] = send(
        w3, acct, tx, label="GDA.distributeFlow(rate=0)", gas=3_000_000,
    )["tx_hash"]

    # Persist + summary
    state["txs"].update(txs)
    state["addresses"].update(addrs)
    STATE.write_text(json.dumps(state, indent=2))

    bal1 = w3.eth.get_balance(acct.address) / 1e18
    print(f"\nDone. started {bal0:.4f} OG, ended {bal1:.4f} OG, spent {bal0-bal1:.4f} OG")
    print(f"\nFramework: {json.dumps(addrs, indent=2)}")
    print(f"\nDemo txs: {json.dumps(txs, indent=2)}")


if __name__ == "__main__":
    main()
