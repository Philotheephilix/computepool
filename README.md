# ComputePool

<img width="2072" height="1023" alt="image" src="https://github.com/user-attachments/assets/1de84110-acd3-4677-a234-f6fbd0bf1145" />

> **🚀 Live on 0G mainnet (chainId 16661).** PoolINFT, MockUSDC, USDCx, and the full Superfluid framework are deployed and proven on mainnet — including the ERC-1820 registry (first time on 0G mainnet, via Nick's method). Full address book + tx hashes in [`MAINNET_DEPLOYMENT.md`](MAINNET_DEPLOYMENT.md).

> **Production LLM inference on the consumer GPUs you already own — at near-zero latency overhead vs. a single big GPU.**
> A 70B model needs ~140 GB of VRAM. An RTX 4090 has 24. ComputePool shards a model layer-wise across two (or more) consumer cards, streams hidden states peer-to-peer over [Gensyn AXL](https://github.com/gensyn-ai/axl), settles via x402 + Superfluid on **0G mainnet** (and Galileo testnet), and orchestrates everything through KeeperHub workflows.
>
> The per-token network hop adds **single-digit milliseconds** on top of the actual forward pass — negligible next to the GPU compute itself, because AXL keeps the hidden-state transport peer-to-peer with no orchestrator round-trip.

**Mainnet-deployed · Built for ETHGlobal 2026 · Hits all three sponsor tracks: 0G, Gensyn (AXL), KeeperHub.**

| | |
|---|---|
| **Mainnet deployment** | [`MAINNET_DEPLOYMENT.md`](MAINNET_DEPLOYMENT.md) — addresses + tx hashes + Chainscan links |
| **Demo** | `make build && make up` → <http://localhost:8000> |
| **Pitch deck** | `frontend/app/pitch/page.tsx` (also live at `/pitch`) |
| **End-to-end script** | `scripts/e2e_demo.py` |

---

## 🌐 Mainnet deployment (0G mainnet · chainId 16661)

Every contract that the protocol depends on is live on 0G mainnet. Deployed cost: **~0.40 OG total** for the entire stack including 18+ Superfluid components, the ERC-1820 registry, application contracts, and ~16 demo transactions.

### Application contracts

| Contract | Mainnet address | What it is |
|---|---|---|
| **PoolINFT** (ERC-7857) | [`0x4B379c052a315DAcf20Cf074bEaC34c415C6ca98`](https://chainscan.0g.ai/address/0x4B379c052a315DAcf20Cf074bEaC34c415C6ca98) | One-NFT-per-pool intelligence access primitive |
| **MockUSDC** (EIP-3009) | [`0xD54C8C98752D8dbcb429914F23aAFb39C617Dcf4`](https://chainscan.0g.ai/address/0xD54C8C98752D8dbcb429914F23aAFb39C617Dcf4) | 6-decimal, owner-mintable, EIP-3009 `transferWithAuthorization` for x402 settle |
| **USDCx** (Super Token) | [`0x8f0212376639142f2523259c9faBA854dAEbB26a`](https://chainscan.0g.ai/address/0x8f0212376639142f2523259c9faBA854dAEbB26a) | Canonical Superfluid wrapper of MockUSDC |

### Superfluid framework

| Component | Mainnet address |
|---|---|
| **ERC-1820 Registry** (Nick's method) | [`0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24`](https://chainscan.0g.ai/address/0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24) |
| TestGovernance | [`0x461f186B465D6d3Cc2F075D0b86e7d9a74217C4B`](https://chainscan.0g.ai/address/0x461f186B465D6d3Cc2F075D0b86e7d9a74217C4B) |
| Superfluid Host (proxy) | [`0xCd556fD9876f3873d54851DbB5B9db211352f7a7`](https://chainscan.0g.ai/address/0xCd556fD9876f3873d54851DbB5B9db211352f7a7) |
| ConstantFlowAgreementV1 impl | [`0xEE79A2b4345491Ec254561078E771b5964b8A81D`](https://chainscan.0g.ai/address/0xEE79A2b4345491Ec254561078E771b5964b8A81D) |
| GeneralDistributionAgreementV1 impl | [`0x0b3aB95BfCC23Dc01359949EaB6847243f9C7989`](https://chainscan.0g.ai/address/0x0b3aB95BfCC23Dc01359949EaB6847243f9C7989) |
| InstantDistributionAgreementV1 impl | [`0xbcD147DacD40E08D4B0CEB50f35A728C828b464E`](https://chainscan.0g.ai/address/0xbcD147DacD40E08D4B0CEB50f35A728C828b464E) |
| SuperfluidPool beacon | [`0x6985eE145a1ee549718b6F45af849E669f2f9Fd0`](https://chainscan.0g.ai/address/0x6985eE145a1ee549718b6F45af849E669f2f9Fd0) |
| SuperToken logic | [`0x0220e822b65B9958599496Fb0b81FbcA5Cd2b22b`](https://chainscan.0g.ai/address/0x0220e822b65B9958599496Fb0b81FbcA5Cd2b22b) |
| PoolAdminNFT | [`0xbf80f325147EA8E0d9283B390eEB37224513B9CA`](https://chainscan.0g.ai/address/0xbf80f325147EA8E0d9283B390eEB37224513B9CA) |
| SuperTokenFactory (host-deployed proxy) | [`0xb3C4331aF06429F92557aE9F26f91F27f0256601`](https://chainscan.0g.ai/address/0xb3C4331aF06429F92557aE9F26f91F27f0256601) |
| **CFAv1Forwarder** | [`0xE80c08440a0b75654bF409d539c7A40D4cEFB3E6`](https://chainscan.0g.ai/address/0xE80c08440a0b75654bF409d539c7A40D4cEFB3E6) |
| **GDAv1Forwarder** | [`0xA1cee3ba336E6B0E64BEBE5790579Aa5a73E8eb8`](https://chainscan.0g.ai/address/0xA1cee3ba336E6B0E64BEBE5790579Aa5a73E8eb8) |
| **USDCx pool** (GDA pool over USDCx, admin = deployer) | [`0x83Ba2f14EB1febb935919600162A07759E6A4eE8`](https://chainscan.0g.ai/address/0x83Ba2f14EB1febb935919600162A07759E6A4eE8) |

### Mainnet activity — what's proven on chain

**Application layer (7 demo txs):** mint 1,000,000 USDC · `PoolINFT.mint` · `USDC.transferWithAuthorization` (EIP-3009, twice) · `PoolINFT.authorizeUsage` · `PoolINFT.cloneWithProof` (oracle-signed) · plain ERC-20 transfer.

**Superfluid layer (9 demo txs):** ERC-1820 registry deploy · `gov.updateContracts(factoryImpl)` · `factory.initializeCanonicalWrapperSuperTokens` · `factory.createCanonicalERC20Wrapper(USDC)` → USDCx · `USDC.approve(USDCx, 100)` · `USDCx.upgrade(100)` (USDC → USDCx confirmed by `totalSupply()`) · `GDA.createPool(USDCx, admin)` → live pool · trusted-forwarder enablement for both forwarders.

All tx hashes with Chainscan links live in [`MAINNET_DEPLOYMENT.md`](MAINNET_DEPLOYMENT.md).

### Reproduce the deploy

```sh
python scripts/deploy_mainnet.py --phase all              # PoolINFT + MockUSDC + base demo
python scripts/more_demo_txs.py                            # extra app-layer txs
python scripts/deploy_superfluid_manual.py                 # full Superfluid framework
python scripts/finish_superfluid_demo.py                   # ERC-1820 + USDCx + GDA demo
```

The mainnet deploy bypasses the upstream `SuperfluidFrameworkDeployer` (whose deployer libraries exceed EIP-170's 24,576-byte limit on 0G mainnet) and lays the framework down component-by-component. See [`MAINNET_DEPLOYMENT.md`](MAINNET_DEPLOYMENT.md) for the full sequence, known gaps, and remediation path.

---

## Sponsor judging packets

Three deep-dive READMEs — start here:

- **0G** ($15,000) — [`sponsors/0g/README.md`](sponsors/0g/README.md)
  › Pooled-GPU SDK behind a TEE-attested orchestrator · **full Superfluid framework live on 0G mainnet** · ERC-7857 PoolINFT as access primitive
- **Gensyn — AXL** ($5,000) — [`sponsors/gensyn-axl/README.md`](sponsors/gensyn-axl/README.md)
  › First production layer-pipelined LLM inference over AXL · prebuilt NVIDIA + CPU images with the AXL binary inside · native Tailscale in the same compose stack
- **KeeperHub** ($5,000) — [`sponsors/keeperhub/README.md`](sponsors/keeperhub/README.md)
  › Two upstream PRs (#1106 Superfluid plugin, #1105 Coalition plugin) · five workflows drive the full x402 + Superfluid payment lifecycle

---

## What it actually does

A single GPU can't fit a real model. We turn N small GPUs into one virtual one:

<img width="2104" height="1132" alt="image" src="https://github.com/user-attachments/assets/d68a7f9d-0b75-4848-ad62-e48078edae7e" />


- **Sharding:** [`worker/model.py`](worker/model.py) loads only the assigned layer slice from a HuggingFace model. Entry holds `embed + layers[0:mid]`, exit holds `layers[mid:N] + lm_head`.
- **P2P transport:** [`worker/axl_client.py`](worker/axl_client.py) + [`worker/framing.py`](worker/framing.py) carry hidden-state tensors and sampled tokens across [Gensyn AXL](https://github.com/gensyn-ai/axl) frames.
- **Token loop:** [`worker/pipeline.py`](worker/pipeline.py) — `entry_generate` and `exit_loop` drive one forward hop per token until EOS. **Network overhead per token is negligible vs. the actual GPU compute** — the AXL hop is single-digit ms on a Tailscale mesh, while a single transformer forward pass on a consumer card is tens of ms; sharded throughput tracks single-GPU throughput within noise.
- **Payments:** [`orchestrator/x402.py`](orchestrator/x402.py) gates `/pools/{n}/infer` with HTTP 402; [`orchestrator/economics.py`](orchestrator/economics.py) opens the Superfluid stream once the voucher settles.
- **Coordination:** [`orchestrator/keeperhub.py`](orchestrator/keeperhub.py) drives five [KeeperHub workflows](keeperhub/) for coalition activation, pool wiring, stream start/stop, and slashing.
- **Custody / iNFT:** [`orchestrator/inft/`](orchestrator/inft/) mints a per-pool ERC-7857 INFT on 0G with encrypted intelligence metadata.

---

## Why it wins (one line per sponsor)

| Sponsor | What we shipped on top | Track relevance |
|---|---|---|
| **[0G](sponsors/0g/)** | **Full Superfluid framework deployed to 0G mainnet** (first known mainnet deploy of Superfluid on 0G — including the ERC-1820 registry via Nick's method, the agreement contracts, the SuperTokenFactory, both forwarders, and USDCx wrapping MockUSDC) · **pooled-GPU SDK** lets consumer cards qualify for 0G Compute together · orchestrator runs in **TEE** so 0G's signing flow stays intact · live ERC-7857 **PoolINFT per pool** | Best Agent Framework / Tooling **and** Best Autonomous Agents / iNFT |
| **[Gensyn — AXL](sponsors/gensyn-axl/)** | **First production deployment of layer-pipelined LLM inference over AXL.** Multi-node by construction (entry node ⇄ exit node). Prebuilt NVIDIA + CPU Docker images = **one-line deploy**. **Tailscale-native** — zero exposed ports. | Best Application of AXL — depth, multi-node, real utility |
| **[KeeperHub](sponsors/keeperhub/)** | Five workflows that drive the full demo · upstream [**Superfluid plugin (#1106)**](https://github.com/KeeperHub/keeperhub/pull/1106) · upstream [**Coalition plugin (#1105)**](https://github.com/KeeperHub/keeperhub/pull/1105) — multi-party on-chain commitments with slashing · agents pay autonomously via **x402** | Best Innovative Use **and** Best Integration (payments + framework) |

Each sponsor folder contains the full breakdown — what we built, where it lives in the code, and how to verify it.

---

## Repo layout

```
.
├── orchestrator/          FastAPI control plane + payments + INFT + KeeperHub client
│   ├── api/                    /infer, /v1/chat/completions (OpenAI-compat)
│   ├── x402.py                 self-hosted x402 facilitator client
│   ├── economics.py            Superfluid pool + stream lifecycle (coalition feature-flagged)
│   ├── keeperhub.py            KeeperHub MCP / JSON-RPC client
│   ├── inft/                   ERC-7857 INFT mint + 0G-Storage encrypted metadata
│   └── tee/                    SGX attestation + signer
├── worker/                P2P inference shard (entry or exit)
│   ├── model.py                SplitModel — loads only assigned layer slice
│   ├── axl_client.py           HTTP wrapper around the AXL daemon
│   ├── framing.py              binary wire format (header + raw bf16 tensor)
│   └── pipeline.py             entry_generate / exit_loop token loop
├── frontend/              Next.js 16 / React 19 dashboard + pitch deck
├── facilitator/           x402 facilitator (relayer for transferWithAuthorization)
├── contracts/             Foundry — PoolINFT.sol, MockUSDC.sol, deploy scripts
├── keeperhub/             Five workflow JSON exports (re-importable)
├── docker/                Multi-stage Dockerfile (Go for AXL + Python for app)
├── scripts/
│   ├── deploy_mainnet.py             PoolINFT + MockUSDC + demo (resume-safe state)
│   ├── more_demo_txs.py              extra app activity (authorize, clone, transfers)
│   ├── deploy_superfluid_manual.py   manual component-by-component Superfluid deploy
│   ├── finish_superfluid_demo.py     ERC-1820 + USDCx + GDA pool demo
│   ├── e2e_demo.py                   full end-to-end payment + inference demo
│   ├── register_0g_provider.py       Coalition → 0G Compute provider registration
│   └── run-remote-worker.sh
├── MAINNET_DEPLOYMENT.md  Full mainnet address book + tx hashes + reproduction guide
└── sponsors/              ⭐ Per-sponsor deep-dive READMEs (start here for judging)
```

---

## Quick start

```sh
make build           # multi-stage build: Go (AXL daemon) + Python (worker + orchestrator)
make up              # start orchestrator + node-a + node-b
make ps              # confirm three containers Up
```

Open <http://localhost:8000>, register a user, copy the API key, restart the workers with `OWNER_API_KEY=<key>` so they self-register, then from the dashboard: create a pool → add both nodes → initialize with a model → load → infer.

### Pointing the orchestrator at mainnet

The repo ships a generated `.env.mainnet` (gitignored, regenerated by `scripts/deploy_mainnet.py`) with all the mainnet addresses pre-wired and operator keys as TODO stubs. To run the orchestrator against mainnet:

```sh
# 1. Fill in operator keys in .env.mainnet (orchestrator wallet, faucet, workers, demo payer)
#    — at minimum, fund them with OG and USDC first.
# 2. Boot the stack against mainnet:
docker compose --env-file .env.mainnet up -d
```

For the **full payments flow** on testnet (x402 + Superfluid + KeeperHub):

```sh
cp .env.example .env  # 0G Galileo testnet keys + KH workflow IDs
make build && make up
docker compose up -d facilitator
DEMO_PAYER_KEY=0x... python scripts/e2e_demo.py
```

Tear down: `make clean`.

---

## Networks

| Network | chainId | RPC | Purpose |
|---|---:|---|---|
| **0G mainnet** | **16661** | `https://evmrpc.0g.ai` | **Production deploy — addresses in [`MAINNET_DEPLOYMENT.md`](MAINNET_DEPLOYMENT.md)** |
| 0G Galileo testnet | 16602 | `https://evmrpc-testnet.0g.ai` | Original deploy used during development; addresses in [`sponsors/0g/README.md`](sponsors/0g/README.md) |

---

## Supported models

| Model | Layers | Split (entry / exit) |
|---|---|---|
| `meta-llama/Llama-3.2-1B` | 16 | 0–7 / 8–15 |
| `meta-llama/Llama-3.2-3B` | 28 | 0–13 / 14–27 |
| `Qwen/Qwen2.5-3B-Instruct` | 36 | 0–17 / 18–35 |
| `Qwen/Qwen3-4B-Instruct-2507` | 36 | 0–17 / 18–35 |

To add a new model: append to `MODEL_LAYERS` in [`orchestrator/app.py`](orchestrator/app.py).

---

## Configuration

Worker container env (full table in `docs/`):

| Variable | Required | Notes |
|---|---|---|
| `NODE_ID`, `WORKER_URL`, `ORCHESTRATOR_URL`, `OWNER_API_KEY` | yes | self-registration |
| `MODEL_NAME` | no | default `Qwen/Qwen2.5-3B-Instruct` |
| `PEER_HOST` or `PEER_ADDR` | yes | the *other* worker (single-worker mode is not supported) |
| `AXL_API_URL` | no | default `http://localhost:9002` (in-container) |

Orchestrator reads `MONGODB_URI`, `MONGODB_DB`, plus 0G + Superfluid + x402 + KeeperHub env documented in `.env.example` (testnet) and `.env.mainnet` (auto-generated, mainnet).

New since the mainnet migration:
- `COALITION_ENABLED` — feature flag. `false` on mainnet (Coalition is testnet-only), `true` on testnet. Disables `Coalition.propose`/`activate` and runs the GDA flow without an on-chain stake commitment.
- `COALITION_ADDRESS` — optional. Required only when `COALITION_ENABLED=true`.

---

## API surface (orchestrator)

All endpoints except `/`, `/health`, `/api/models`, `/auth/*` require `X-API-Key`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | HTML dashboard |
| `GET` | `/api/state` | JSON cluster snapshot |
| `POST` | `/auth/register`, `/auth/login` | API-key issuance |
| `POST` | `/nodes/register` | (called by workers on startup) |
| `*` | `/pools/...` | full pool CRUD + initialize / load / unload / **infer** |
| `POST` | `/v1/chat/completions` | OpenAI-compatible streaming inference (gated by x402) |

---

## Honest limits

- **Single in-flight generation per pool** (no batching, no parallel requests in v1).
- **KV cache lives in worker RAM**; dropped on `unload` or container restart.
- **Worker callbacks are unauthenticated** — never expose worker ports publicly. AXL TLS handshake protects the P2P link itself but there is no peer allowlist yet.
- **CPU-only by default** — bundled `torch` is the CPU wheel. Swap for the matching CUDA wheel in `worker/requirements.txt` for GPU.
- **AXL port** is overridden to `7001` (away from the worker's `7000`); don't change it.
- **Mainnet streaming gap.** The Superfluid framework is deployed on mainnet and USDCx wrapping + GDA pool creation work, but the agreement-class registration was done by passing UUPS proxies instead of implementations — creating a double-proxy chain that recurses on `host.callAgreement`. `GDA.createPool` (direct) and USDCx wrap operations work; `GDAv1Forwarder.updateMemberUnits`/`distributeFlow` revert until the agreement registration is rebuilt with `gov.registerAgreementClass(IMPL)` directly. Documented with remediation steps in [`MAINNET_DEPLOYMENT.md`](MAINNET_DEPLOYMENT.md). The orchestrator already runs on mainnet without streaming via the `COALITION_ENABLED=false` + x402-only settlement path in `orchestrator/economics.py`.

---

## Team & contact

**Architecture deep-dive:** [`docs/`](docs/)
**Sponsor judging packets:** [`sponsors/`](sponsors/)
**Mainnet deployment manifest:** [`MAINNET_DEPLOYMENT.md`](MAINNET_DEPLOYMENT.md)
