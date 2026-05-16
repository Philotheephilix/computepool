# Sponsor Highlights

> **For judges :** start here. Each subfolder is a self-contained submission for one sponsor track. Every claim links back to the file in this repo where the work lives.

ComputePool ships **one product** that satisfies **three sponsor tracks** because each sponsor's stack solves a different layer of the same problem — and we extended each one upstream rather than just consuming it.

## The three tracks

| Folder | Sponsor | Prize pool | What we built **on top of** their stack |
|---|---|---:|---|
| [`0g/`](0g/) | **0G** | $15,000 | First **CREATE2-deployed verified Superfluid contracts** on 0G Galileo · **pooled-GPU SDK** that lets consumer cards qualify for 0G Compute · TEE-attested orchestrator preserving 0G's signing model · live ERC-7857 **INFT per pool** |

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
