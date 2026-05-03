# ETHGlobal submission — form copy

Drop-in answers for each field on the submission form. Update in place as you fill it out.

---

## Tagline

> **Many small GPUs, one big model.**

---

## Short description (≤100 chars)

> Many small GPUs, one big model. Production LLM inference, sharded across consumer cards.

(88 characters)

---

## Description (long — min 280 chars)

> ComputePool is a sharded inference network that turns idle consumer GPUs into production AI infrastructure. A Llama-3 70B model needs ~140 GB of VRAM in fp16; an RTX 4090 has 24. So inference today funnels to three hyperscalers while hundreds of millions of capable consumer cards sit idle — each one alone is too small to host a real model.
>
> We split the model layer-wise across two or more cards. The entry shard holds embeddings plus the first half of transformer blocks; the exit shard holds the second half plus the lm_head. Hidden-state activations stream peer-to-peer over Gensyn's AXL transport; sampled tokens come back the same way. The orchestrator never touches activations. Throughput tracks single-GPU throughput within noise — the per-token network hop is single-digit milliseconds against a forward pass that takes tens.
>
> Operators get paid per second of compute. A user opens a session with one x402 voucher; the orchestrator opens a Superfluid USDCx stream that flows to every operator in the coalition while inference runs, and stops the moment the request closes. KeeperHub workflows drive every state transition — propose, activate, stream start/stop, slash — so the full payment lifecycle is auditable and retry-safe.
>
> To make it work we shipped infrastructure back to the sponsor stacks: CREATE2-deployed verified Superfluid contracts on 0G Galileo (the chain's first per-second money primitive), two upstream PRs to KeeperHub — a Superfluid plugin ([#1106](https://github.com/KeeperHub/keeperhub/pull/1106)) and a Coalition plugin ([#1105](https://github.com/KeeperHub/keeperhub/pull/1105), multi-party on-chain commitments with slashing) — and a turnkey AXL deployment pattern with prebuilt NVIDIA + CPU Docker images plus Tailscale-native networking (zero exposed ports). Each pool is also minted as an ERC-7857 INFT with encrypted intelligence on 0G Storage. The orchestrator runs inside a TEE so 0G Compute's signing and attestation flow stays intact.
>
> Live on 0G Galileo testnet. Run `make build && make up` to bring up the cluster locally; `python scripts/e2e_demo.py` runs the end-to-end payment + sharded-inference demo.

---

## How it's made (long — min 280 chars)

> **The stack.** The control plane is Python (FastAPI + Motor for async MongoDB) running an orchestrator that exposes a REST API plus an OpenAI-compatible streaming router (`orchestrator/api/openai_compat.py`). Each worker is a separate Python container running FastAPI with HuggingFace Transformers / PyTorch (bfloat16 on CPU by default, CUDA-ready) plus a Go binary — Gensyn's AXL daemon — running side-by-side as the P2P data plane. The frontend is Next.js 16 / React 19 / Tailwind v4. Smart contracts (`PoolINFT.sol`, `Coalition.sol`) are Foundry, deployed to 0G Galileo testnet. Everything is containerized in a multi-stage Dockerfile (Go stage builds AXL; Python stage layers the worker + orchestrator on top).
>
> **The token loop.** The orchestrator never touches activations. On `/pools/{n}/infer`, the entry worker tokenizes the prompt, runs `forward_entry` over its layer slice (embed + first half of transformer blocks), packs the resulting hidden-state tensor with our own binary framing (4-byte LE header length, JSON header, raw bytes), and `axl.send`s it to the exit peer. The exit worker, in a background `exit_loop` async task, polls `axl.recv`, runs `forward_exit` over its slice (second half + lm_head), samples the next token, and `axl.send`s it back. Both sides keep a HuggingFace `DynamicCache` keyed by `request_id`, dropped on `unload` or on receipt of a `control/end` frame. Throughput tracks single-GPU throughput within noise — the per-token AXL hop is single-digit milliseconds against a forward pass that takes tens.
>
> **Gensyn — AXL.** AXL is the entire data plane between shards. Without it we'd need a TURN server or a centralized relay; with it, every operator gets an encrypted, decentralized comms layer via a single binary on localhost. We wrote a thin async HTTP wrapper (`worker/axl_client.py`) around AXL's `/send`, `/recv`, `/topology` endpoints, plus a custom binary frame format (`worker/framing.py`) that's bf16-safe. For deployment we bundled AXL with prebuilt NVIDIA + CPU Docker images and added a Tailscale Compose overlay (`docker-compose.tailscale.yml`) so operators expose **zero public ports** — AXL still gets a routable peer address via the tailnet (100.x.x.x) and the AXL handshake completes peer-to-peer over that. Multi-node by construction: `make up` brings up two AXL daemons in separate containers, and `scripts/run-remote-worker.sh` joins a third worker on a remote host with one command.
>
> **0G — chain, storage, compute, INFT.** ComputePool runs on 0G Galileo testnet (chainId 16602). Three concrete usages of 0G:
> 1. **0G Storage** holds encrypted INFT intelligence blobs (`orchestrator/inft/storage_0g.py` + `crypto.py`). Each pool is minted as an ERC-7857 PoolINFT (`contracts/src/PoolINFT.sol`) whose intelligence lives encrypted on 0G Storage; the on-chain INFT references the content hash and the canonical metadata.
> 2. **0G Compute** — we register the coalition as an attested provider via `scripts/register_0g_provider.py` against the 0G router ABI (`scripts/0g_router.abi.json`). The orchestrator runs inside a TEE (`orchestrator/tee/attestation.py`, `tee/signer.py`); 0G Compute verifies the attestation quote, so a coalition of N consumer GPUs presents to 0G as one attested provider — no protocol downgrade.
> 3. **0G Chain** — we CREATE2-deployed and source-verified the full Superfluid stack (Host, agreements, factories, GDAv1Forwarder, CFAv1Forwarder, USDCx via SuperTokenFactory). Per-second money streams are now a public primitive on 0G; anyone in the ecosystem can call them.
>
> **KeeperHub.** Every payment-side state transition runs through a KeeperHub workflow. Five JSON exports live in `keeperhub/`: `propose`, `activate-and-pool`, `stream-start`, `stream-stop`, `handle-breach`. The orchestrator drives them via KH's MCP/JSON-RPC endpoint (`orchestrator/keeperhub.py`), and KH calls back via webhooks (`orchestrator/webhooks.py` + `webhook_verifier.py` for HMAC). On top of *using* KH we shipped two upstream PRs — [**KeeperHub#1106 — Superfluid plugin**](https://github.com/KeeperHub/keeperhub/pull/1106) so any KH workflow can speak `createPool`, `updateMemberUnits`, `distributeFlow` natively, and [**KeeperHub#1105 — Coalition plugin**](https://github.com/KeeperHub/keeperhub/pull/1105) for multi-party on-chain commitments with slashing (N operators commit to serve a model; the keeper enforces and slashes any that breach). Specs at `PRD-2-superfluid-plugin.md` and `PRD-1-coalition-plugin.md`. Agents pay autonomously via x402: the OpenAI-compat router returns HTTP 402 with the challenge, the agent signs and replays.
>
> **x402 + Superfluid bond.** A single signed x402 voucher (EIP-3009 `transferWithAuthorization` on a USDC mock) opens the session via our self-hosted facilitator (`facilitator/`); once settlement clears, the orchestrator fires the KH `stream-start` workflow which calls `GDA distributeFlow` at the negotiated rate, paying every operator in the coalition by the second. On EOS or client disconnect, the orchestrator fires `stream-stop` and the meter halts to the second.
>
> **Notable hacks worth mentioning:**
> - **bf16 on the wire.** numpy doesn't support bfloat16, so we round-trip the activation tensor as a `uint8` view of the raw bytes inside the AXL frame and reinterpret on the other side. Half the bandwidth vs. converting to fp32.
> - **AXL port collision.** AXL's default TCP port is 7000, which collides with the worker's HTTP port. We override to 7001 in the generated `node-config.json` at container startup. (Lost 90 minutes to this on day 1.)
> - **Tied-weight detach on exit shard.** Llama / Qwen tie `lm_head.weight` to `embed_tokens.weight`. The exit shard only loads the back half of the model — but the embed lives on the entry shard. We explicitly clone-and-detach the lm_head weight before `del`-ing the original full model so the exit survives.
> - **React 19 strict-mode race.** Next.js 16 + React 19 strict-mode double-mounts SSE consumers, which raced the x402 settlement (second mount tried to settle a voucher the first had already spent). We disabled strict mode in `next.config.ts` rather than re-architect the stream lifecycle inside the hackathon window.
> - **TEE-in-Docker.** Running an SGX/TDX enclave under Docker Compose for the orchestrator — getting the device passthrough right and the attestation quote round-tripped to 0G Compute's verifier — was the longest single yak-shave of the build.
> - **CREATE2 Superfluid deploy on 0G.** Producing deterministic verified addresses for the entire Superfluid stack on a fresh chain meant generating salts, replaying the canonical bytecode, and re-verifying every upgradeable proxy on the 0G explorer. Worth it: the contracts are now public infrastructure.

---

## Per-prize qualification answers

Repo: <https://github.com/philotheephilix/computepool>

### Gensyn — $5,000

**Why we're applicable**

> ComputePool is the first production deployment of layer-pipelined LLM inference over AXL — every per-token hidden-state activation between the entry shard and exit shard crosses an AXL frame, and every sampled token comes back the same way. The orchestrator never touches activations; AXL is the entire data plane between separate AXL nodes (multi-node by construction, satisfying the "communication across separate AXL nodes" qualification). We also ship a turnkey AXL deployment pattern: prebuilt NVIDIA + CPU Docker images for one-line deploy, plus a Tailscale Compose overlay so operators expose **zero public ports** while AXL still gets a routable peer address.

**Link to the line of code where the tech is used**

<https://github.com/philotheephilix/computepool/blob/main/sponsors/gensyn-axl/README.md>

(Single README covering every AXL touchpoint: per-token AXL hop in `worker/pipeline.py`, the HTTP wrapper in `worker/axl_client.py`, the bf16-safe binary frame format in `worker/framing.py`, the Tailscale-native compose recipe in `docker-compose.tailscale.yml`, plus the multi-node deploy script and the full file index.)

**Ease of API / Protocol** → **8 / 10**

A single binary on localhost speaking HTTP is genuinely the easiest networking primitive we've shipped against. The encryption / peer discovery / routing handled for free is enormous. Two points off only for the day-1 port collision and the lack of a tensor-data reference example.

**Additional feedback for Gensyn**

- **Default port (7000) collides** with very common app defaults (any worker that uses `:7000` will clash). Picking `9999` or another less-common port as the daemon default would have saved real time on day 1; we override to `:7001` in `node-config.json` at container startup.
- **Reference example for binary tensor data over AXL would have been gold.** We rolled our own framing (`worker/framing.py`) including a uint8 round-trip for bfloat16 because numpy doesn't support bf16 natively. A tiny example in the docs would prevent every AI builder from re-deriving this.
- **Document a Tailscale composition recipe.** AXL is perfect for residential operators who can't open ports; the Tailscale + AXL pattern is non-obvious but very natural once you see it.
- **Peer allowlist primitive.** Anyone who reaches `:7001` and presents a valid TLS handshake can become a peer. An allowlist (or a "joinable only with this token" mode) would unlock production deployments where you trust some peers but not all.
- **MCP/A2A worked well** — no notes.

---

### 0G — $15,000

**Why we're applicable**

> ComputePool hits **both 0G prize tracks**. *Best Agent Framework / Tooling*: a **pooled-GPU SDK** that lets consumer cards qualify for 0G Compute together — the entry shard and exit shard each load only their layer slice, and the coalition presents to 0G as one TEE-attested provider so the existing signing model is preserved end-to-end. *Best Autonomous Agents / iNFT*: each pool is minted as an **ERC-7857 PoolINFT** with encrypted intelligence on **0G Storage**, and earns **per-second royalties via Superfluid** (which we deployed by CREATE2 to 0G Galileo as the chain's first per-second money primitive — verified, public, callable by anyone in the ecosystem).

**Link to the line of code where the tech is used**

<https://github.com/philotheephilix/computepool/blob/main/sponsors/0g/README.md>

(Single README covering every 0G touchpoint: deployed Superfluid contract addresses on Galileo testnet — GDA/CFA forwarders, USDC/USDCx, Coalition, PoolINFT — with explorer links, the code paths that call them, the pooled-GPU SDK, the TEE attestation flow, and the ERC-7857 INFT integration.)

**Ease of API / Protocol** → **6 / 10**

0G Chain UX is excellent (Galileo testnet is fast, the explorer is good, EVM compatibility removed all friction). 0G Storage worked first-try. The longest learning curve was 0G Compute provider registration and the TEE attestation handshake — docs exist but a runnable end-to-end example would have changed the rating.

**Additional feedback for 0G**

- **0G Compute provider registration needs an end-to-end runnable example.** We pieced ours together from the router ABI (`scripts/0g_router.abi.json`) and protocol reading. A single `register-and-serve.sh` walkthrough would land a lot of teams on Compute.
- **0G Storage SDK parity.** TS and Python clients should expose the same surface; we ended up writing thin wrappers in Python (`orchestrator/inft/storage_0g.py`) where a maintained SDK would have been welcome.
- **CREATE2 deploy guide for cross-chain protocols.** We deployed Superfluid to 0G via CREATE2 to land deterministic verified addresses — generating salts, replaying canonical bytecode, re-verifying upgradeable proxies on the explorer was substantial yak-shaving. A canonical "bring this protocol to 0G" guide (with examples for an upgradeable-proxy stack) would unblock a lot of ecosystem porting.
- **Explorer verification for upgradeable proxies** could be smoother — the proxy/implementation pairing UI tripped us up a few times.
- **INFT (ERC-7857) cookbook.** Mint → encrypt → reference flow with a working code sample would help builders hit the iNFT track. Right now you have to read the spec and the contract together.
- **Galileo testnet faucet rate limits** — fine for dev, but doing operator dry-runs at scale required asking around.

---

### KeeperHub — $5,000

**Why we're applicable**

> ComputePool drives its **entire payment + coalition lifecycle** through five KeeperHub workflows (`propose`, `activate-and-pool`, `stream-start`, `stream-stop`, `handle-breach`). KeeperHub isn't bolted on — pull it out and the product collapses. On top of *using* KH, we shipped two **upstream PRs** against `KeeperHub/keeperhub:staging`: [**#1106 — Superfluid plugin**](https://github.com/KeeperHub/keeperhub/pull/1106) (12 commits, native streaming-money actions: `createPool` / `updateMemberUnits` / `distributeFlow`), and [**#1105 — Coalition plugin**](https://github.com/KeeperHub/keeperhub/pull/1105) (18 commits, multi-party on-chain commitments with slashing — N operators commit, the keeper enforces and slashes any that breach). Agents pay autonomously via **x402** through our OpenAI-compat router; KeeperHub takes over the payout side — covering both KeeperHub focus areas (Innovative Use *and* Integration with payment rails).

**Link to the line of code where the tech is used**

<https://github.com/philotheephilix/computepool/blob/main/sponsors/keeperhub/README.md>

(Single README covering every KH touchpoint: the MCP/JSON-RPC client in `orchestrator/keeperhub.py`, the five workflow JSON exports in `keeperhub/`, the workflow driver in `orchestrator/economics.py`, the HMAC-verified webhook receiver in `orchestrator/webhooks.py`, the x402 paywall in `orchestrator/x402.py`, the two upstream PRs — [Superfluid plugin #1106](https://github.com/KeeperHub/keeperhub/pull/1106) and [Coalition plugin #1105](https://github.com/KeeperHub/keeperhub/pull/1105) — and the full file index.)

**Ease of API / Protocol** → **6 / 10**

Workflows themselves are intuitive once authored, the dashboard UX is excellent, webhook signing is solid. Two points off because there's no stable documented public endpoint for triggering Manual workflow executions — the dashboard and the MCP server share an internal JSON-RPC path at `/mcp` that we had to reverse-engineer (see the comment at the top of `orchestrator/keeperhub.py`).

**Additional feedback for KeeperHub**

- **Stable public REST/JSON-RPC for triggering Manual workflows.** The `/mcp` JSON-RPC channel works, but it isn't documented as a public API. Promoting it (or a parallel REST surface) to a stable public contract would unblock a lot of integrations and remove the "is this allowed?" question.
- **Workflow exports are great, but they reference the source org's `integrationId`.** A docs section on the portable export/import flow (or a CLI that rewrites IDs at import time) would smooth team handoffs. Right now we instruct users to `sed` through the JSON.
- **Superfluid as a first-class plugin would close a real gap.** Streaming payouts are increasingly the right shape for agent economies; happy to land our PR.
- **Multi-party commitment / slashing** is missing as a first-class primitive. Our Coalition plugin PR ([#1105](https://github.com/KeeperHub/keeperhub/pull/1105)) addresses this — N operators commit on-chain, the keeper enforces and slashes any that breach. Useful well beyond our use case (any workflow that orchestrates an N-party agreement should have it).
- **CLI for workflow run inspection during dev** would help debug loops faster — we tailed orchestrator logs because tracing a failing workflow through the dashboard was slower than reading our own webhook receipts.
- **Webhook retry semantics + HMAC verification are excellent** — no notes.

