# ComputePool — Sponsor Prize Tracks

ComputePool ships **one product** that satisfies **three sponsor tracks**. Each sponsor's stack solves a different layer of the same problem — sharded LLM inference on consumer GPUs, settled per second, payable by autonomous agents — and we extended each one upstream rather than just consuming it.

---

## Submission evidence

- **Live demo:** <https://computepool.philotheephilix.in>
- **Local bring-up:** `make build && make up` → <http://localhost:8000>
- **End-to-end script (x402 → KH → Superfluid → inference):** [`scripts/e2e_demo.py`](scripts/e2e_demo.py)
- **Pitch deck:** [`frontend/app/pitch/page.tsx`](frontend/app/pitch/page.tsx) (also live at `/pitch`)
- **Sponsor judging packets (deep dives):** [`sponsors/`](sponsors/) — one folder per track
- **Team:** single-builder hackathon entry — contact via the wallet shown on the live dashboard or open an issue on this repo.

---

## 0G — $15,000 Total

> **About:** Intelligent Layer 1 for onchain AI with a decentralized AI OS (dAIOS). Core components: 0G Storage, 0G DA, 0G Compute Network, and 0G Chain (EVM-compatible, Galileo testnet chainId `16602`).

We hit **both** 0G prize tracks under a single coherent thesis: **let consumer GPUs qualify for 0G Compute behind one TEE-attested provider face, gated by a real ERC-7857 INFT, settled by the chain's first per-second money primitive.**

### Best Agent Framework / Tooling — $7,500

A **pooled-GPU SDK** that onboards consumer cards (4090s, 3090s, M-series Macs) to 0G Compute without changing 0G's signing model:

- **TEE-attested orchestrator.** SGX/TDX enclave generates the attestation quote ([`orchestrator/tee/attestation.py`](orchestrator/tee/attestation.py)); signing keys are provisioned **inside** the enclave ([`orchestrator/tee/signer.py`](orchestrator/tee/signer.py)); `GET /attestation` ([`orchestrator/api/attestation.py`](orchestrator/api/attestation.py)) surfaces the quote so 0G Compute admits the coalition as one attested provider.
- **Coalition shards behind the orchestrator.** [`worker/model.py`](worker/model.py) loads only the assigned layer slice per consumer GPU. From 0G's view: one provider. From the supply side: N consumer GPUs.
- **First per-second money primitive on 0G Galileo.** We CREATE2-deployed and source-verified the Superfluid forwarders on chainId `16602`. Bytecode + ABI are byte-identical to the upstream [Superfluid protocol monorepo](https://github.com/superfluid-finance/protocol-monorepo) — any standard Superfluid client (`@superfluid-finance/sdk-core`, viem, ethers) works unmodified by pointing at these addresses:

  | Contract | Address |
  |---|---|
  | GDAv1Forwarder | [`0xfDF1C52BBe39884Bd9fDF2407903ff3a91a25B17`](https://chainscan-galileo.0g.ai/address/0xfDF1C52BBe39884Bd9fDF2407903ff3a91a25B17) |
  | CFAv1Forwarder | [`0xb3ded3B98a8b586fF50e41EE54E3Aa0f3c41eB72`](https://chainscan-galileo.0g.ai/address/0xb3ded3B98a8b586fF50e41EE54E3Aa0f3c41eB72) |
  | USDC (EIP-3009 mock for x402 vouchers) | [`0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189`](https://chainscan-galileo.0g.ai/address/0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189) |
  | USDCx (Super Token wrap of USDC) | [`0x3A818444F7341bFa7287Be7f58CB86bF12F39Af2`](https://chainscan-galileo.0g.ai/address/0x3A818444F7341bFa7287Be7f58CB86bF12F39Af2) |

  How ComputePool calls these: [`orchestrator/onchain.py`](orchestrator/onchain.py) (`createPool`, `updateMemberUnits`, `distributeFlow` via web3.py) + [`orchestrator/economics.py`](orchestrator/economics.py) (lifecycle).

**Why this scales 0G Compute exponentially:** supply growth stops being bounded by datacenter procurement and starts being bounded by "operators willing to run a Docker container." 0G's signing/attestation model is preserved exactly as-is — the orchestrator is the attested party, the coalition is its private implementation detail.

### Best Autonomous Agents / iNFT — $7,500

The INFT in our architecture **is the pool**. Not a souvenir token — the on-chain handle that controls the pool's intelligence, gates access, and routes payouts.

- **Identity.** Every pool has exactly one PoolINFT ([`contracts/src/PoolINFT.sol`](contracts/src/PoolINFT.sol) — deployed at [`0xe57192EB63433A5A4f76C9E5F33c3f2a64AeeFd4`](https://chainscan-galileo.0g.ai/address/0xe57192EB63433A5A4f76C9E5F33c3f2a64AeeFd4)). Whoever holds the INFT *is* the pool's owner. Transfer the token, transfer the pool.
- **Gate.** The pool's actual intelligence — model weights / adapter blob / system prompt — lives **encrypted** on 0G Storage ([`orchestrator/inft/storage_0g.py`](orchestrator/inft/storage_0g.py)). The symmetric key is sealed to the INFT holder's pubkey via `seal_to_pubkey` in [`orchestrator/inft/crypto.py`](orchestrator/inft/crypto.py). Without the INFT the encrypted intelligence is opaque bytes.
- **Royalty router.** The pool earns Superfluid USDCx streams while inference runs; receivers' units are weighted by the GDA pool's `updateMemberUnits` calls. Transferring the INFT transfers the future royalty rights with no migration step.

Mint + lifecycle: [`orchestrator/inft/service.py`](orchestrator/inft/service.py); on-chain → orchestrator bridge: [`orchestrator/inft/oracle.py`](orchestrator/inft/oracle.py); canonical metadata + content hash: [`orchestrator/inft/metadata.py`](orchestrator/inft/metadata.py).

**Coalition contract** (N-party operator commitments + slashing): [`0x6647E81040a3E9BF658e107360c638c5DD04d1eF`](https://chainscan-galileo.0g.ai/address/0x6647E81040a3E9BF658e107360c638c5DD04d1eF).

**Where to look:** [`sponsors/0g/README.md`](sponsors/0g/README.md) for the full deep dive, including the file index and address table.

---

## Gensyn — AXL — $5,000

> **About:** AXL is Gensyn's P2P transport for distributed ML — ed25519-TLS, NAT-traversing, designed for tight peer-to-peer hops between training/inference nodes. Repo: <https://github.com/gensyn-ai/axl>.

We made AXL **deployable in one command** and shipped the AXL workload everyone wants but nobody had: **layer-pipelined LLM inference across separate AXL nodes.**

### Best Application of AXL — $5,000

- **First production deployment of layer-pipelined LLM inference over AXL.** [`worker/pipeline.py`](worker/pipeline.py) — `entry_generate` runs the first half of the model, packs the hidden-state tensor with [`framing.pack_tensor`](worker/framing.py), and `axl.send`s it. `exit_loop` runs `forward_exit`, samples the next token, and `axl.send`s it back. **Per token. Tens of MB of activations crossing AXL every second.**
- **Multi-node by construction.** `make up` brings up `node-a` + `node-b` as separate containers, each with its own AXL daemon. The orchestrator is HTTP control plane only (`configure`, `load`, `unload`, `generate`); the inference data plane is **exclusively AXL P2P**.
- **Prebuilt NVIDIA + CPU Docker images for one-line deploy.** Multi-stage [`docker/Dockerfile`](docker/Dockerfile) compiles the AXL daemon (Go stage) and layers the worker on top (Python stage). One image, `dis-com:latest`, with the **AXL binary already inside** — no Go toolchain on the operator's host. CPU variant: [`docker-compose.yml`](docker-compose.yml). NVIDIA overlay: [`docker-compose.gpu.yml`](docker-compose.gpu.yml) + [`docker-compose.gpu-extra.yml`](docker-compose.gpu-extra.yml). One-line operator onboarding: [`scripts/run-remote-worker.sh`](scripts/run-remote-worker.sh).
- **Native Tailscale in the same compose stack.** [`docker-compose.tailscale.yml`](docker-compose.tailscale.yml) runs a Tailscale sidecar; the worker uses `network_mode: "service:tailscale"` so AXL binds to the tailnet interface. Result for an operator on a residential ISP: **0 ports open to the public internet**, AXL handshake completes peer-to-peer through any NAT, traffic is double-encrypted (WireGuard + AXL ed25519 TLS).

**Wire format:** [`worker/framing.py`](worker/framing.py) — bf16-safe binary frames (numpy lacks bfloat16, so we round-trip the tensor as a `uint8` view). **AXL HTTP wrapper:** [`worker/axl_client.py`](worker/axl_client.py) — async wrapper around AXL's `/send`, `/recv`, `/topology`.

**Net result for AXL adoption:** the next ten projects shipping on AXL fork our Dockerfile, swap the worker payload, and ship same-day — without asking operators to "open a port on your home router."

**Where to look:** [`sponsors/gensyn-axl/README.md`](sponsors/gensyn-axl/README.md) for the full deep dive and file index.

---

## KeeperHub — $5,000

> **About:** Execution and reliability layer for AI agents operating onchain. Guaranteed onchain execution with retry logic, gas optimization, private routing, and audit trails. Native MCP, CLI, x402, and MPP support.

We hit **both** focus areas under one ranked prize pool: two upstream PRs against `KeeperHub/keeperhub:staging`, plus the first KeeperHub product wiring **x402 vouchers + Superfluid streams as a single payment primitive.**

### Best Use of KeeperHub — $4,500 (Innovative Use + Integration)

**Two upstream PRs to KeeperHub:**

| PR | Title | Commits | What it adds |
|---|---|---:|---|
| [**KeeperHub#1106**](https://github.com/KeeperHub/keeperhub/pull/1106) | `feat: add Superfluid protocol` | 12 | Native KH actions for Superfluid: `createPool`, `updateMemberUnits`, `distributeFlow`. Any KH workflow can now stream tokens per-second without bespoke contract calls. |
| [**KeeperHub#1105**](https://github.com/KeeperHub/keeperhub/pull/1105) | `feat: add Coalition plugin (multi-party on-chain commitments with slashing)` | 18 | First-class primitive for "N parties commit on-chain to do a thing; if any breach, the keeper slashes." Useful for any multi-operator workflow that touches money. |

**x402 + Superfluid bonded as a single workflow primitive.** The shape every API economy lands on is *"pay once to start, then pay per second while you use it."* That's two protocols today — x402 for the open, Superfluid for the meter — and nobody had wired them together. We did. The orchestrator runs the bond:

1. Agent calls the API → OpenAI-compatible router returns `HTTP 402` with the x402 challenge ([`orchestrator/x402.py`](orchestrator/x402.py)).
2. Agent signs the voucher (EIP-3009 `transferWithAuthorization`) and replays. Self-hosted facilitator settles it on-chain ([`facilitator/`](facilitator/)).
3. Orchestrator fires the KH `stream-start` workflow → KH calls `GDA.distributeFlow` at the negotiated rate.
4. Operators earn USDCx by the second while inference runs.
5. EOS or client disconnect fires `stream-stop` → meter halts to the second.

**Five workflow JSON exports drive the full payment lifecycle** (re-importable from [`keeperhub/`](keeperhub/)):

| Workflow | Action |
|---|---|
| [`compute-coalition-propose.workflow.json`](keeperhub/compute-coalition-propose.workflow.json) | `Coalition.propose` → POST `coalition_proposed` |
| [`compute-coalition-activate-and-pool.workflow.json`](keeperhub/compute-coalition-activate-and-pool.workflow.json) | `Coalition.activate` → `GDA.createPool` → `updateMemberUnits` ×2 → POST `payment_pool_ready` |
| [`compute-coalition-stream-start.workflow.json`](keeperhub/compute-coalition-stream-start.workflow.json) | `GDA.distributeFlow(rate)` → POST `stream_started` |
| [`compute-coalition-stream-stop.workflow.json`](keeperhub/compute-coalition-stream-stop.workflow.json) | `GDA.distributeFlow(0)` → POST `stream_stopped` |
| [`compute-coalition-handle-breach.workflow.json`](keeperhub/compute-coalition-handle-breach.workflow.json) | `recordBreach` → `slash` → `updateMemberUnits=0` → POST `breach_slashed` |

**Drivers + callbacks:** [`orchestrator/keeperhub.py`](orchestrator/keeperhub.py) (KH MCP/JSON-RPC client), [`orchestrator/economics.py`](orchestrator/economics.py) (drives the workflows), [`orchestrator/webhooks.py`](orchestrator/webhooks.py) + [`orchestrator/webhook_verifier.py`](orchestrator/webhook_verifier.py) (HMAC-verified callbacks).

**Framework integration.** Our OpenAI-compat router ([`orchestrator/api/openai_compat.py`](orchestrator/api/openai_compat.py)) means any LangChain / CrewAI / OpenAgents client routes through KH **with no SDK** — `POST /v1/chat/completions` with one signed x402 voucher, and the entire downstream payment lifecycle runs through KeeperHub workflows.

**Where to look:** [`sponsors/keeperhub/README.md`](sponsors/keeperhub/README.md) for the full deep dive, including PR branch references and the file index.

---

## Why one product, three tracks

> **Production LLMs don't fit on consumer GPUs. We shard them across many small GPUs, settle per second, and let any framework pay autonomously.**

- **0G** gives us the chain, the compute network we want consumer GPUs to plug into, and the iNFT primitive for embedded intelligence.
- **AXL (Gensyn)** is the only P2P transport that makes the per-token hidden-state hop tight enough to be production-viable on commodity hardware.
- **KeeperHub** is the workflow layer that turns "agents need to pay" into a real, retryable, auditable on-chain action — and we taught it to speak Superfluid + x402.

Pull any one of the three out and the product collapses. That's why the same codebase is a credible submission to all three tracks.
