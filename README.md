# ComputePool

> **Production LLM inference on the consumer GPUs you already own — at near-zero latency overhead vs. a single big GPU.**
> A 70B model needs ~140 GB of VRAM. An RTX 4090 has 24. ComputePool shards a model layer-wise across two (or more) consumer cards, streams hidden states peer-to-peer over [Gensyn AXL](https://github.com/gensyn-ai/axl), settles via x402 + Superfluid on **0G Galileo testnet**, and orchestrates everything through KeeperHub workflows.
>
> The per-token network hop adds **single-digit milliseconds** on top of the actual forward pass — negligible next to the GPU compute itself, because AXL keeps the hidden-state transport peer-to-peer with no orchestrator round-trip.

**Live on 0G Galileo testnet · Built for ETHGlobal 2026 · Hits all three sponsor tracks: 0G, Gensyn (AXL), KeeperHub.**

| | |
|---|---|
| **Demo** | `make build && make up` → <http://localhost:8000> |
| **Pitch deck** | `frontend/app/pitch/page.tsx` (also live at `/pitch`) |
| **End-to-end script** | `scripts/e2e_demo.py` |
| **Sponsor write-ups** | [`sponsors/`](sponsors/) — one folder per track |
| **Prize tracks** | [`prizes.md`](prizes.md) — submission summary across 0G, Gensyn (AXL), KeeperHub |

---

## What it actually does

A single GPU can't fit a real model. We turn N small GPUs into one virtual one:

```
                                   x402 voucher        Superfluid stream (USDCx/s)
                                       │                      │
   prompt  ───►  orchestrator  ───►  ┌─┴───────────┐      ┌───┴──────────┐
                 (FastAPI,           │ entry shard │ AXL  │ exit shard   │
                  TEE-attested)      │ layers 0..M │ ◄══► │ layers M..N  │
                                     │ node-a      │      │ node-b       │
                                     └─────────────┘      └──────────────┘
                                       hidden states ───►
                                       ◄─── sampled token
```

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
| **[0G](sponsors/0g/)** | First **CREATE2-deployed verified Superfluid contracts** on 0G Galileo · **pooled-GPU SDK** lets consumer cards qualify for 0G Compute together · orchestrator runs in **TEE** so 0G's signing flow stays intact · live ERC-7857 **INFT per pool** | Best Agent Framework / Tooling **and** Best Autonomous Agents / iNFT |
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
│   ├── economics.py            Superfluid pool + stream lifecycle
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
├── contracts/             Foundry — PoolINFT.sol, deploy scripts
├── keeperhub/             Five workflow JSON exports (re-importable)
├── docker/                Multi-stage Dockerfile (Go for AXL + Python for app)
├── scripts/               e2e_demo.py, register_0g_provider.py, run-remote-worker.sh
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

For the **full payments flow** (x402 + Superfluid + KeeperHub):

```sh
cp .env.example .env  # fill 0G testnet keys + KH workflow IDs + Superfluid addresses
make build && make up
docker compose up -d facilitator
DEMO_PAYER_KEY=0x... python scripts/e2e_demo.py
```

Tear down: `make clean`.

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

Orchestrator reads `MONGODB_URI`, `MONGODB_DB`, plus 0G + Superfluid + x402 + KeeperHub env documented in `.env.example`.

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

---

## Team & contact

Single-builder hackathon entry. Contact via the wallet shown on the live dashboard, or open an issue on this repo.

**Architecture deep-dive:** [`docs/`](docs/)
**Sponsor judging packets:** [`sponsors/`](sponsors/)
