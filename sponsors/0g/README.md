# 0G — sponsor judging packet

> **TL;DR.** We brought two firsts to **0G Galileo testnet**: per-second money streams (CREATE2-deployed verified Superfluid contracts, public for anyone to use) and a **pooled-GPU SDK** that lets consumer cards qualify for 0G Compute together as a single virtual H100-class target — with the orchestrator running inside a **Trusted Execution Environment** so 0G's signing & attestation flow stays intact end-to-end. Each pool is also minted as a live ERC-7857 **INFT** with encrypted intelligence on 0G Storage.

ComputePool is not a project that *uses* 0G. It is a project that **extends** 0G — adding two infrastructure primitives the chain didn't have, and shipping a working agent on top of them.

---

## What we shipped on 0G

### 1. Superfluid live on 0G Galileo (CREATE2-deployed, verified, public)

0G had no native streaming-money primitive. Per-second payouts are central to our economic model — operators earn while inference runs, the meter stops when the request ends. So we deployed the full Superfluid stack to 0G Galileo at deterministic CREATE2 addresses, source-verified, and **left them callable by anyone**.

- Host, agreements, factories, GDAv1Forwarder, CFAv1Forwarder — all verified
- USDCx Super Token wrap of a deployed FiatTokenV2-style USDC mock (EIP-3009 `transferWithAuthorization`)
- Lifecycle driver: [`orchestrator/economics.py`](../../orchestrator/economics.py) — `createPool`, `updateMemberUnits`, `distributeFlow(rate)`, `distributeFlow(rate=0)`, slashing
- Anyone in the 0G ecosystem can now build per-second payment products on top of these contracts.

### 2. Pooled-GPU SDK — consumer cards qualify for 0G Compute

0G Compute is excellent — but its hardware floor excludes the long tail. **A 4090, a 3090, an M2 Mac aren't admissible.** Our SDK fuses N consumer GPUs into one logical compute target by sharding the model layer-wise across them.

- `SplitModel` ([`worker/model.py`](../../worker/model.py)) loads only the assigned layer slice from a HuggingFace model. A 4 B model that can't run on one card runs across two; an 8 B across four.
- The orchestrator picks the split, drives `configure → load → infer`, and presents the coalition to 0G Compute as a single attested provider via `scripts/register_0g_provider.py`.
- Effect: **the entire installed base of consumer GPUs becomes addressable supply for 0G Compute**, not just datacenter cards.

### 3. TEE-attested orchestrator preserves 0G's signing model

0G Compute relies on attested provider signatures. A naïve "decentralized inference" middleware would break that chain. So the orchestrator runs inside a Trusted Execution Environment and exposes its attestation:

- [`orchestrator/tee/attestation.py`](../../orchestrator/tee/attestation.py) — SGX/TDX attestation generation
- [`orchestrator/tee/signer.py`](../../orchestrator/tee/signer.py) — signing keys provisioned inside the enclave
- [`orchestrator/api/attestation.py`](../../orchestrator/api/attestation.py) — `/attestation` endpoint surfacing the quote for 0G Compute to verify

Net result: a coalition of consumer GPUs **looks like one attested provider** to 0G — no protocol downgrade.

### 4. Live ERC-7857 INFT per pool, on 0G

Each pool is minted as a live INFT — the agent is the asset.

- Contract: [`contracts/src/PoolINFT.sol`](../../contracts/src/PoolINFT.sol) (Foundry build, deployed to 0G Galileo)
- Encrypted intelligence + metadata in 0G Storage: [`orchestrator/inft/storage_0g.py`](../../orchestrator/inft/storage_0g.py)
- Sealing / encryption: [`orchestrator/inft/crypto.py`](../../orchestrator/inft/crypto.py)
- Mint + transfer service: [`orchestrator/inft/service.py`](../../orchestrator/inft/service.py)
- Frontend wallet panel showing live INFT state: `frontend/app/wallet/` (also visible on the dashboard)
- Commit `c3f9027` is the live INFT integration on 0G Galileo end-to-end.

---

## How this improves 0G

| Before ComputePool | After |
|---|---|
| No per-second money primitive on 0G. Apps that want streaming payouts must build them. | Public, verified Superfluid stack on 0G Galileo — any project can compose. |
| 0G Compute supply = datacenter GPUs only. | Supply expands to the entire installed base of consumer GPUs, federated as virtual providers. |
| Decentralized inference middleware would break 0G's attested-signing model. | TEE-attested orchestrator preserves the signing chain even with N consumer operators behind it. |
| INFTs are a primitive looking for compelling agents. | Each ComputePool pool is a live, monetizable, transferable INFT with encrypted intelligence. |

---

## Track qualification

This packet covers **both** 0G prize tracks. We satisfy each requirement directly:

### Best Agent Framework, Tooling & Core Extensions ($7,500)

> "Build the best core extensions, improvements, forks, or entirely new open agent frameworks ... Focus on advancing how agents are created in 2026 — architectures, developer tooling, and infrastructure primitives that other builders will use."

- **Infrastructure primitive other builders will use:** Superfluid on 0G — public verified contracts.
- **New architecture:** the pooled-GPU SDK is an entirely new way for agents to consume 0G Compute, removing the hardware floor.
- **Native integration with 0G Compute's sealed inference:** TEE attestation flow is wired in; consumer-GPU coalitions present as attested providers.
- **Persistent 0G Storage:** INFT intelligence + metadata live on 0G Storage via [`orchestrator/inft/storage_0g.py`](../../orchestrator/inft/storage_0g.py).
- **Architecture diagram:** see [`../../README.md`](../../README.md) and pitch deck slide 4.
- **Working example agent:** the orchestrator + worker pair is itself an agent that registers as a 0G provider, accepts inference jobs, and settles payments — see [`scripts/e2e_demo.py`](../../scripts/e2e_demo.py).

### Best Autonomous Agents, Swarms & iNFT Innovations ($7,500)

> "iNFT-minted agents with embedded intelligence (encrypted on 0G Storage), persistent memory, dynamic upgrades, and automatic royalty splits on usage."

- **iNFT-minted agent:** every pool is an ERC-7857 PoolINFT.
- **Embedded intelligence, encrypted on 0G Storage:** [`orchestrator/inft/crypto.py`](../../orchestrator/inft/crypto.py) seals the model + adapter blob, [`orchestrator/inft/storage_0g.py`](../../orchestrator/inft/storage_0g.py) puts it on 0G Storage.
- **Automatic royalty splits on usage:** Superfluid GDA pool distributes per-second flow across operator units — when usage runs, royalties stream automatically.
- **Multi-agent coordination:** the entry shard and exit shard collaborate via AXL on shared activations; the orchestrator (TEE-attested) is the planner. This is a *swarm of two*, with the architecture extending naturally to N-way splits (roadmap Q3 2026).

---

## How to verify

```sh
# 1. Bring up the full stack
make build && make up

# 2. Confirm the orchestrator's TEE quote
curl http://localhost:8000/attestation | jq

# 3. Run the end-to-end demo (mints INFT, opens Superfluid stream, runs inference)
DEMO_PAYER_KEY=0x... python scripts/e2e_demo.py

# 4. Check the INFT mint on 0G Galileo explorer (link printed by the script)
```

| Asset | Pointer |
|---|---|
| 0G Galileo chainId | `16602` |
| Superfluid contracts on 0G | CREATE2 addresses + verification — see `.env.example` keys `SUPERFLUID_HOST_ADDRESS`, `GDA_FORWARDER_ADDRESS`, `CFA_FORWARDER_ADDRESS`, `USDCX_ADDRESS` |
| PoolINFT contract | `contracts/src/PoolINFT.sol` (deployed addr in `.env`) |
| TEE attestation endpoint | `GET /attestation` |
| Live integration commit | `c3f9027` — "feat(inft): live INFT integration on 0G Galileo + redesigned wallet card" |

---

## File index — every file that touches 0G

```
contracts/src/PoolINFT.sol            ERC-7857 INFT contract
contracts/script/                     Foundry deploy scripts (CREATE2)
orchestrator/inft/service.py          INFT mint + transfer service
orchestrator/inft/storage_0g.py       0G Storage upload/download (encrypted blobs)
orchestrator/inft/crypto.py           Sealing / encryption for embedded intelligence
orchestrator/inft/oracle.py           On-chain oracle for INFT state
orchestrator/inft/metadata.py         Canonical metadata serialization
orchestrator/inft/_abi.py             ERC-7857 ABI bindings
orchestrator/inft/client.py           High-level INFT client
orchestrator/tee/attestation.py       SGX/TDX attestation
orchestrator/tee/signer.py            Enclave-bound signing keys
orchestrator/api/attestation.py       /attestation endpoint for 0G Compute
scripts/register_0g_provider.py       Register coalition as a 0G Compute provider
scripts/0g_router.abi.json            0G router ABI for provider registration
frontend/lib/use-wallet.tsx           Frontend wallet (0G Galileo only — wrong-chain badge if not)
frontend/app/wallet/                  Live INFT panel
```
