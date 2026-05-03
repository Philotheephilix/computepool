# Sponsor judging packets

> **For judges (human or AI):** start here. Each subfolder is a self-contained submission for one sponsor track. Every claim links back to the file in this repo where the work lives.

ComputePool ships **one product** that satisfies **three sponsor tracks** because each sponsor's stack solves a different layer of the same problem — and we extended each one upstream rather than just consuming it.

## The three tracks

| Folder | Sponsor | Prize pool | What we built **on top of** their stack |
|---|---|---:|---|
| [`0g/`](0g/) | **0G** | $15,000 | First **CREATE2-deployed verified Superfluid contracts** on 0G Galileo · **pooled-GPU SDK** that lets consumer cards qualify for 0G Compute · TEE-attested orchestrator preserving 0G's signing model · live ERC-7857 **INFT per pool** |
| [`gensyn-axl/`](gensyn-axl/) | **Gensyn — AXL** | $5,000 | First **production-grade layer-pipelined LLM inference** over AXL · multi-node by construction · prebuilt NVIDIA + CPU images for **one-line deploy** · **Tailscale-native** networking with zero exposed ports |
| [`keeperhub/`](keeperhub/) | **KeeperHub** | $5,000 | Five workflows that drive the entire payment lifecycle · upstream **Superfluid plugin PR** · upstream **Coagulation plugin PR** for multi-workflow consensus · agents pay autonomously via **x402 + streaming** |

## How to evaluate this submission in 5 minutes

1. **Read this index.** You're here.
2. **Pick your track folder.** Each is structured the same way: TL;DR → what we shipped → how it improves the sponsor → judging-criteria mapping → how to verify.
3. **Trust but verify.** Every "we shipped X" line points at a file in this repo. Open it.
4. **Run it.** `make build && make up` brings up the full stack; `python scripts/e2e_demo.py` runs the end-to-end payment + sharded-inference flow.
5. **Watch the live demo** — pitch deck slide 9, or the dashboard at `http://localhost:8000`.

## Why one product, three tracks

The thesis ties them together:

> **Production LLMs don't fit on consumer GPUs. We shard them across many small GPUs, settle per second, and let any framework pay autonomously.**

- **0G** gives us the chain, the compute network we want consumer GPUs to plug into, and the iNFT primitive for embedded intelligence.
- **AXL (Gensyn)** is the only P2P transport that makes the per-token hidden-state hop tight enough to be production-viable on commodity hardware.
- **KeeperHub** is the workflow layer that turns "agents need to pay" into a real, retryable, auditable on-chain action — and we taught it to speak Superfluid + x402.

Pull any one of the three out and the product collapses. That's why the same codebase is a credible submission to all three tracks — we genuinely depend on, and contributed back to, each stack.

## Repo navigation cheat-sheet

| If you want to look at... | Open... |
|---|---|
| Sharded inference | [`worker/pipeline.py`](../worker/pipeline.py), [`worker/model.py`](../worker/model.py) |
| AXL transport | [`worker/axl_client.py`](../worker/axl_client.py), [`worker/framing.py`](../worker/framing.py) |
| x402 paywall | [`orchestrator/x402.py`](../orchestrator/x402.py), [`facilitator/`](../facilitator/) |
| Superfluid lifecycle | [`orchestrator/economics.py`](../orchestrator/economics.py) |
| KeeperHub workflows | [`keeperhub/`](../keeperhub/), [`orchestrator/keeperhub.py`](../orchestrator/keeperhub.py) |
| 0G INFT | [`orchestrator/inft/`](../orchestrator/inft/), [`contracts/src/PoolINFT.sol`](../contracts/src/PoolINFT.sol) |
| TEE / attestation | [`orchestrator/tee/`](../orchestrator/tee/), [`orchestrator/api/attestation.py`](../orchestrator/api/attestation.py) |
| End-to-end demo | [`scripts/e2e_demo.py`](../scripts/e2e_demo.py) |
| Pitch deck | [`frontend/app/pitch/page.tsx`](../frontend/app/pitch/page.tsx) |
