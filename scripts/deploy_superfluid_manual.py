"""Manual Superfluid framework deploy for 0G mainnet.

Why this exists:
    The upstream SuperfluidFrameworkDeployer relies on helper libraries
    (SuperfluidGDAv1DeployerLibrary in particular) whose runtime bytecode
    exceeds EIP-170's 24,576-byte limit. 0G mainnet enforces the standard
    limit, so the framework deployer reverts when deploying those libraries.

    The actual Superfluid component contracts (Host, CFA, IDA, GDA, factories,
    forwarders) all fit individually. This script deploys each one directly,
    bypassing the bloated wrapper libraries.

What this deploys:
    1. TestGovernance
    2. Superfluid (Host) implementation + UUPSProxy + initialize
    3. ConstantFlowAgreementV1 + proxy + register with governance
    4. SuperfluidUpgradeableBeacon (for the pool implementation)
    5. GeneralDistributionAgreementV1 + proxy + register (uses SlotsBitmap +
       SuperfluidPoolDeployer libraries linked into its bytecode)
    6. SuperfluidPool (real impl) + beacon.upgradeTo
    7. InstantDistributionAgreementV1 + proxy + register
    8. PoolAdminNFT
    9. SuperToken logic + SuperTokenFactory + proxy + initialize + register
   10. CFAv1Forwarder + GDAv1Forwarder
   11. USDCx via factory.createERC20Wrapper(MockUSDC, …)
   12. Demo txs: USDC.approve, USDCx.upgrade, GDA.createPool,
       updateMemberUnits, distributeFlow(start), distributeFlow(stop).

Run:
    source .venv/bin/activate
    python scripts/deploy_superfluid_manual.py
"""
from __future__ import annotations

import json
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

SF = Path("/tmp/sf-pkg/node_modules/@superfluid-finance/ethereum-contracts/build/truffle")


# ────────────────────────────────────────────────────────────────────────────
# bytecode helpers
# ────────────────────────────────────────────────────────────────────────────


def placeholder_for(name: str) -> str:
    body = name[:36].ljust(36, "_")
    return f"__{body}__"


def link_bytecode(bc: str, links: dict[str, str]) -> str:
    """Replace `__LibName______` placeholders with deployed addresses (no 0x)."""
    for name, addr in links.items():
        ph = placeholder_for(name)
        clean = addr.lower().removeprefix("0x")
        if ph in bc:
            bc = bc.replace(ph, clean)
    leftover = re.findall(r"__[A-Za-z0-9_$]{36,38}__", bc)
    assert not leftover, f"unlinked placeholders: {set(leftover)}"
    return bc


def load_artifact(name: str) -> dict:
    return json.loads((SF / f"{name}.json").read_text())


# ────────────────────────────────────────────────────────────────────────────
# tx helpers
# ────────────────────────────────────────────────────────────────────────────


def w3_connect() -> Web3:
    w3 = Web3(HTTPProvider(RPC_URL, request_kwargs={"timeout": 90}))
    assert w3.eth.chain_id == CHAIN_ID
    return w3


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
    status = "ok" if r["status"] == 1 else "REVERTED"
    print(f"    ← {label}  {status}  tx={h.hex()}  block={r['blockNumber']}  gas_used={r['gasUsed']:,}")
    if r["status"] != 1:
        raise RuntimeError(f"{label} reverted; tx=0x{h.hex().removeprefix('0x')}")
    return {"tx_hash": "0x" + h.hex().removeprefix("0x"), "receipt": r}


def gas_for_deploy(bytecode_hex: str) -> int:
    bc_bytes = len(bytecode_hex.removeprefix("0x")) // 2
    # 200 gas/byte storage + ~30% headroom + 200k for constructor
    return int(bc_bytes * 260 + 300_000)


def deploy_raw(w3: Web3, acct: Account, *, bytecode: str, label: str) -> str:
    g = gas_for_deploy(bytecode)
    r = send(w3, acct, {"data": bytecode}, label=f"deploy {label}", gas=g)
    addr = r["receipt"]["contractAddress"]
    code = w3.eth.get_code(addr)
    print(f"      {label} @ {addr}  code={len(code)}B")
    return addr


def deploy_contract(
    w3: Web3, acct: Account, *, artifact_name: str, ctor_args: list, links: dict[str, str] | None = None,
    label: str | None = None,
) -> tuple[str, list]:
    art = load_artifact(artifact_name)
    bc = art["bytecode"]
    if links and re.search(r"__[A-Za-z0-9_$]{36,38}__", bc):
        bc = link_bytecode(bc, links)
    # Encode constructor args
    if ctor_args:
        c = w3.eth.contract(abi=art["abi"], bytecode=bc)
        tx = c.constructor(*ctor_args).build_transaction({"from": acct.address})
        data = tx["data"]
    else:
        data = bc if bc.startswith("0x") else "0x" + bc
    addr = deploy_raw(w3, acct, bytecode=data, label=label or artifact_name)
    return addr, art["abi"]


# ────────────────────────────────────────────────────────────────────────────
# main flow
# ────────────────────────────────────────────────────────────────────────────


def main() -> None:
    print(f"=== Manual Superfluid deploy → {RPC_URL} (chainId {CHAIN_ID}) ===")
    state = json.loads(STATE.read_text())
    usdc_addr = state["addresses"]["MockUSDC"]

    acct = Account.from_key(json.loads(KEYS.read_text())["privateKey"])
    w3 = w3_connect()
    bal0 = w3.eth.get_balance(acct.address) / 1e18
    print(f"  deployer: {acct.address}  balance: {bal0:.4f} OG")
    if bal0 < 0.5:
        sys.exit("low balance")

    # Use existing libraries from prior deploy attempt (already on-chain)
    libs = state.get("superfluid", {}).get("libraries", {})
    print(f"  reusing libraries: {list(libs.keys())}")
    needed_libs = {"SlotsBitmapLibrary", "SuperfluidPoolDeployerLibrary"}
    missing = needed_libs - set(libs.keys())
    if missing:
        sys.exit(f"missing required libraries: {missing}")

    addrs: dict[str, str] = {}
    txs: dict[str, str] = {}

    # ── 1) TestGovernance ────────────────────────────────────────────────
    print("\n── 1) TestGovernance ──")
    gov_addr, gov_abi = deploy_contract(w3, acct, artifact_name="TestGovernance", ctor_args=[], label="TestGovernance")
    addrs["governance"] = gov_addr

    # ── 2) Superfluid (Host) impl ───────────────────────────────────────
    print("\n── 2) Superfluid impl ──")
    sf_impl_addr, sf_abi = deploy_contract(
        w3, acct, artifact_name="Superfluid",
        ctor_args=[False, False, 3_000_000, "0x0000000000000000000000000000000000000000",
                   "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
        label="Superfluid (Host impl)",
    )

    # ── 3) UUPSProxy for Host + initialize chain ────────────────────────
    print("\n── 3) Host proxy + initialize ──")
    proxy_addr, proxy_abi = deploy_contract(w3, acct, artifact_name="UUPSProxy", ctor_args=[], label="UUPSProxy(Host)")
    addrs["host"] = proxy_addr

    proxy = w3.eth.contract(address=proxy_addr, abi=proxy_abi)
    tx = proxy.functions.initializeProxy(sf_impl_addr).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="HostProxy.initializeProxy(impl)", gas=300_000)

    # Now call Superfluid.initialize(governance) via the proxy
    host = w3.eth.contract(address=proxy_addr, abi=sf_abi)
    tx = host.functions.initialize(gov_addr).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Host.initialize(governance)", gas=300_000)

    # Initialize governance (host, rewardAddress, liquidationPeriod, patricianPeriod, trustedForwarders)
    gov = w3.eth.contract(address=gov_addr, abi=gov_abi)
    tx = gov.functions.initialize(
        proxy_addr, acct.address, 14400, 2880, []
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Governance.initialize(host, ...)", gas=500_000)

    # ── 4) CFA impl + proxy + register ──────────────────────────────────
    print("\n── 4) CFA agreement ──")
    cfa_impl, cfa_abi = deploy_contract(w3, acct, artifact_name="ConstantFlowAgreementV1",
                                        ctor_args=[proxy_addr], label="CFAv1 impl")
    cfa_proxy, _ = deploy_contract(w3, acct, artifact_name="UUPSProxy", ctor_args=[], label="UUPSProxy(CFA)")
    addrs["cfa"] = cfa_proxy
    cfa_proxy_c = w3.eth.contract(address=cfa_proxy, abi=proxy_abi)
    tx = cfa_proxy_c.functions.initializeProxy(cfa_impl).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="CFAProxy.initializeProxy(impl)", gas=300_000)

    tx = gov.functions.registerAgreementClass(proxy_addr, cfa_proxy).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Gov.registerAgreementClass(CFA)", gas=600_000)

    # ── 5) Pool beacon + GDA + register ─────────────────────────────────
    print("\n── 5) Pool beacon + GDA agreement ──")
    # Placeholder pool impl using deployer address as the GDA arg (we'll replace beacon target later)
    tmp_pool_impl, pool_abi = deploy_contract(w3, acct, artifact_name="SuperfluidPool",
                                              ctor_args=[acct.address], label="SuperfluidPool (placeholder)")
    beacon, beacon_abi = deploy_contract(w3, acct, artifact_name="SuperfluidUpgradeableBeacon",
                                         ctor_args=[tmp_pool_impl], label="SuperfluidUpgradeableBeacon")

    # GDA impl needs SlotsBitmapLibrary + SuperfluidPoolDeployerLibrary linked
    gda_impl, gda_abi = deploy_contract(
        w3, acct, artifact_name="GeneralDistributionAgreementV1",
        ctor_args=[proxy_addr, beacon],
        links=libs,
        label="GDAv1 impl",
    )
    gda_proxy, _ = deploy_contract(w3, acct, artifact_name="UUPSProxy", ctor_args=[], label="UUPSProxy(GDA)")
    addrs["gda"] = gda_proxy
    gda_proxy_c = w3.eth.contract(address=gda_proxy, abi=proxy_abi)
    tx = gda_proxy_c.functions.initializeProxy(gda_impl).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="GDAProxy.initializeProxy(impl)", gas=300_000)

    tx = gov.functions.registerAgreementClass(proxy_addr, gda_proxy).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Gov.registerAgreementClass(GDA)", gas=600_000)

    # Now deploy the REAL pool impl with the correct GDA proxy address, and point beacon at it
    print("    deploying real pool impl pointing at GDA proxy...")
    real_pool_impl, _ = deploy_contract(w3, acct, artifact_name="SuperfluidPool",
                                        ctor_args=[gda_proxy], label="SuperfluidPool (real)")
    addrs["poolImpl"] = real_pool_impl
    beacon_c = w3.eth.contract(address=beacon, abi=beacon_abi)
    tx = beacon_c.functions.upgradeTo(real_pool_impl).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="PoolBeacon.upgradeTo(realImpl)", gas=200_000)
    addrs["poolBeacon"] = beacon

    # ── 6) IDA impl + proxy + register (needs SlotsBitmapLibrary) ───────
    print("\n── 6) IDA agreement ──")
    ida_impl, ida_abi = deploy_contract(
        w3, acct, artifact_name="InstantDistributionAgreementV1",
        ctor_args=[proxy_addr],
        links={k: libs[k] for k in libs if k == "SlotsBitmapLibrary"},
        label="IDAv1 impl",
    )
    ida_proxy, _ = deploy_contract(w3, acct, artifact_name="UUPSProxy", ctor_args=[], label="UUPSProxy(IDA)")
    addrs["ida"] = ida_proxy
    ida_proxy_c = w3.eth.contract(address=ida_proxy, abi=proxy_abi)
    tx = ida_proxy_c.functions.initializeProxy(ida_impl).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="IDAProxy.initializeProxy(impl)", gas=300_000)

    tx = gov.functions.registerAgreementClass(proxy_addr, ida_proxy).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Gov.registerAgreementClass(IDA)", gas=600_000)

    # ── 7) PoolAdminNFT ─────────────────────────────────────────────────
    print("\n── 7) PoolAdminNFT ──")
    pool_admin_nft, _ = deploy_contract(w3, acct, artifact_name="PoolAdminNFT",
                                        ctor_args=[proxy_addr, gda_proxy], label="PoolAdminNFT")
    addrs["poolAdminNFT"] = pool_admin_nft

    # ── 8) SuperToken logic + SuperTokenFactory ─────────────────────────
    print("\n── 8) SuperTokenFactory ──")
    st_logic, _ = deploy_contract(w3, acct, artifact_name="SuperToken",
                                  ctor_args=[proxy_addr, pool_admin_nft], label="SuperToken logic")
    addrs["superTokenLogic"] = st_logic

    factory_impl, factory_abi = deploy_contract(
        w3, acct, artifact_name="SuperTokenFactory",
        ctor_args=[proxy_addr, st_logic, pool_admin_nft, "0x0000000000000000000000000000000000000000"],
        label="SuperTokenFactory impl",
    )
    factory_proxy, _ = deploy_contract(w3, acct, artifact_name="UUPSProxy", ctor_args=[], label="UUPSProxy(Factory)")
    addrs["superTokenFactory"] = factory_proxy
    fp = w3.eth.contract(address=factory_proxy, abi=proxy_abi)
    tx = fp.functions.initializeProxy(factory_impl).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="FactoryProxy.initializeProxy(impl)", gas=300_000)

    # Call factory.initialize() via proxy
    factory = w3.eth.contract(address=factory_proxy, abi=factory_abi)
    tx = factory.functions.initialize().build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Factory.initialize()", gas=300_000)

    # Register the factory with the host via governance.updateContracts
    tx = gov.functions.updateContracts(
        proxy_addr,
        "0x0000000000000000000000000000000000000000",  # hostNewLogic (no upgrade)
        [],                                            # agreementClassNewLogics
        factory_proxy,                                 # superTokenFactoryNewLogic — registers the factory
        "0x0000000000000000000000000000000000000000",  # poolBeaconNewLogic
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Gov.updateContracts(factory)", gas=800_000)

    # ── 9) Forwarders ───────────────────────────────────────────────────
    print("\n── 9) CFAv1Forwarder + GDAv1Forwarder ──")
    cfa_fwd, _ = deploy_contract(w3, acct, artifact_name="CFAv1Forwarder",
                                 ctor_args=[proxy_addr], label="CFAv1Forwarder")
    gda_fwd, gda_fwd_abi = deploy_contract(w3, acct, artifact_name="GDAv1Forwarder",
                                           ctor_args=[proxy_addr], label="GDAv1Forwarder")
    addrs["cfaV1Forwarder"] = cfa_fwd
    addrs["gdaV1Forwarder"] = gda_fwd

    # Trusted-forwarder authorization on host (otherwise GDAv1Forwarder is rejected)
    tx = gov.functions.enableTrustedForwarder(
        proxy_addr,
        "0x0000000000000000000000000000000000000000",  # apply across all super tokens
        gda_fwd,
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    send(w3, acct, tx, label="Gov.enableTrustedForwarder(GDAv1Forwarder)", gas=300_000)

    state.setdefault("superfluid", {})["framework"] = addrs
    STATE.write_text(json.dumps(state, indent=2))

    # ── 10) USDCx wrapper ───────────────────────────────────────────────
    print("\n── 10) Wrap MockUSDC → USDCx via SuperTokenFactory ──")
    # createERC20Wrapper(address underlyingToken, uint8 upgradability, string name, string symbol)
    # upgradability: 0 = NON_UPGRADABLE, 1 = SEMI, 2 = FULL
    create_call = factory.functions.createERC20Wrapper(
        Web3.to_checksum_address(usdc_addr), 0, "Super USDC", "USDCx",
    )
    tx = create_call.build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label="Factory.createERC20Wrapper(USDC, NON_UPGRADABLE, USDCx)", gas=6_000_000)
    txs["factory_create_usdcx"] = r["tx_hash"]
    # Find the SuperTokenCreated event
    usdcx_addr = None
    for log in r["receipt"]["logs"]:
        if not log["topics"]:
            continue
        sig = Web3.keccak(text="SuperTokenCreated(address)").hex()
        topic = log["topics"][0].hex()
        if topic.removeprefix("0x") == sig.removeprefix("0x"):
            usdcx_addr = Web3.to_checksum_address("0x" + log["topics"][1].hex()[-40:])
            break
    assert usdcx_addr is not None, "did not find SuperTokenCreated event"
    addrs["USDCx"] = usdcx_addr
    state["addresses"]["USDCx"] = usdcx_addr
    STATE.write_text(json.dumps(state, indent=2))
    print(f"      USDCx @ {usdcx_addr}")

    # ── 11) Demo ────────────────────────────────────────────────────────
    print("\n── 11) Demo flow ──")
    usdc_abi = json.loads("""[
      {"name":"approve","type":"function","stateMutability":"nonpayable",
       "inputs":[{"name":"s","type":"address"},{"name":"v","type":"uint256"}],
       "outputs":[{"type":"bool"}]},
      {"name":"balanceOf","type":"function","stateMutability":"view",
       "inputs":[{"name":"a","type":"address"}],"outputs":[{"type":"uint256"}]}
    ]""")
    usdc = w3.eth.contract(address=usdc_addr, abi=usdc_abi)
    usdcx = w3.eth.contract(address=usdcx_addr, abi=load_artifact("SuperToken")["abi"])
    gda_forwarder = w3.eth.contract(address=gda_fwd, abi=gda_fwd_abi)

    # 11a) Approve USDCx to pull 100 USDC
    underlying_amount = 100 * 10**6  # 100 USDC (6 dp)
    super_amount_18 = 100 * 10**18  # 100 USDCx (always 18 dp)
    tx = usdc.functions.approve(usdcx_addr, underlying_amount).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    txs["usdc_approve_usdcx"] = send(w3, acct, tx, label="USDC.approve(USDCx, 100)", gas=100_000)["tx_hash"]

    # 11b) Upgrade USDC → USDCx
    tx = usdcx.functions.upgrade(super_amount_18).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    txs["usdcx_upgrade_100"] = send(w3, acct, tx, label="USDCx.upgrade(100)", gas=400_000)["tx_hash"]
    bal_x = usdcx.functions.balanceOf(acct.address).call()
    print(f"      USDCx balance: {bal_x/1e18:.4f}")

    # 11c) Create a GDA pool via the forwarder
    tx = gda_forwarder.functions.createPool(
        usdcx_addr, acct.address, (False, False),
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    r = send(w3, acct, tx, label="GDAv1Forwarder.createPool(USDCx, admin)", gas=3_500_000)
    txs["gda_create_pool"] = r["tx_hash"]
    # Decode pool address from return value via eth_call replay
    tx_obj = w3.eth.get_transaction(r["tx_hash"])
    raw = w3.eth.call({"from": tx_obj["from"], "to": tx_obj["to"], "data": tx_obj["input"]},
                      tx_obj["blockNumber"] - 1)
    pool_addr = Web3.to_checksum_address("0x" + raw.hex()[88:128])
    txs["gda_pool_address"] = pool_addr
    print(f"      pool @ {pool_addr}")

    # 11d) Add a member with units=1
    member = Account.create()
    tx = gda_forwarder.functions.updateMemberUnits(
        pool_addr, member.address, 1, b"",
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    txs["gda_update_member_units"] = send(
        w3, acct, tx, label=f"GDA.updateMemberUnits({member.address}, 1)", gas=500_000,
    )["tx_hash"]

    # 11e) Start flow: 1e12 wei/sec USDCx
    flow_rate = 10**12
    tx = gda_forwarder.functions.distributeFlow(
        usdcx_addr, acct.address, pool_addr, flow_rate, b"",
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    txs["gda_distribute_flow_start"] = send(
        w3, acct, tx, label=f"GDA.distributeFlow(rate={flow_rate})", gas=3_000_000,
    )["tx_hash"]

    print("      sleeping 20s to let stream accrue...")
    time.sleep(20)

    # 11f) Stop flow
    tx = gda_forwarder.functions.distributeFlow(
        usdcx_addr, acct.address, pool_addr, 0, b"",
    ).build_transaction({"from": acct.address})
    for k in ("nonce", "chainId", "maxFeePerGas", "maxPriorityFeePerGas", "type", "gas"):
        tx.pop(k, None)
    txs["gda_distribute_flow_stop"] = send(
        w3, acct, tx, label="GDA.distributeFlow(rate=0)", gas=3_000_000,
    )["tx_hash"]

    # Persist final state
    state["txs"].update(txs)
    state["addresses"].update(addrs)
    STATE.write_text(json.dumps(state, indent=2))

    bal1 = w3.eth.get_balance(acct.address) / 1e18
    print(f"\nDone. Started {bal0:.4f} OG, ended {bal1:.4f} OG, spent {bal0-bal1:.4f} OG.")
    print(f"\nFramework: {json.dumps(addrs, indent=2)}")


if __name__ == "__main__":
    main()
