# KeeperHub — sponsor judging packet

> **TL;DR.** ComputePool drives its **entire** payment + coalition lifecycle through KeeperHub workflows — five of them — and we shipped two upstream PRs against `KeeperHub/keeperhub:staging`:
> - [**#1106 — Superfluid plugin**](https://github.com/KeeperHub/keeperhub/pull/1106) (12 commits) — native streaming-money actions
> - [**#1105 — Coalition plugin**](https://github.com/KeeperHub/keeperhub/pull/1105) (18 commits) — multi-party on-chain commitments with slashing
>
> Agents pay autonomously via **x402 vouchers** at session open and earn **per-second Superfluid streams** while inference runs. This is the first project to wire KeeperHub to both halves of the agent-economy stack: atomic pay-per-call **and** continuous payouts.

> *"We brought streaming money to the workflow layer."* — pitch deck, slide 6.

This packet covers **both KeeperHub focus areas**: Innovative Use **and** Integration with payment rails.

---

## What we shipped on KeeperHub

### 1. Five workflows that drive the entire demo

Every payment + coalition state transition goes through KeeperHub — not a python script pretending. Re-importable JSON exports live in [`keeperhub/`](../../keeperhub/):

| Workflow | Purpose | KH ID |
|---|---|---|
| [`compute-coalition-propose.workflow.json`](../../keeperhub/compute-coalition-propose.workflow.json) | `Coalition.propose(...)` → POST `coalition_proposed` | `1tmtaw7r4u2nr0hpt3kgf` |
| [`compute-coalition-activate-and-pool.workflow.json`](../../keeperhub/compute-coalition-activate-and-pool.workflow.json) | `Coalition.activate` → `GDA createPool` → 2× `updateMemberUnits` → POST `payment_pool_ready` | `8mah6alp4w5a1eb4eqj6s` |
| [`compute-coalition-stream-start.workflow.json`](../../keeperhub/compute-coalition-stream-start.workflow.json) | `GDA distributeFlow` at requested rate → POST `stream_started` | `i4loo42c2uv66stpmxuw0` |
| [`compute-coalition-stream-stop.workflow.json`](../../keeperhub/compute-coalition-stream-stop.workflow.json) | `GDA distributeFlow` rate=0 → POST `stream_stopped` | `y0tztp0kv2ke5szdu8arp` |
| [`compute-coalition-handle-breach.workflow.json`](../../keeperhub/compute-coalition-handle-breach.workflow.json) | `recordBreach` → `slash` → `updateMemberUnits` to 0 → POST `breach_slashed` | `lg2mw6be5tck0scx1zxcv` |

The orchestrator drives these via [`orchestrator/keeperhub.py`](../../orchestrator/keeperhub.py) — KH's MCP/JSON-RPC client — and reacts to webhook callbacks in [`orchestrator/webhooks.py`](../../orchestrator/webhooks.py) + [`orchestrator/webhook_verifier.py`](../../orchestrator/webhook_verifier.py).

This isn't *using* KeeperHub. It is **using KeeperHub as the system of record for the on-chain payment lifecycle of an AI inference product**.

### 2. Upstream PR — Superfluid plugin

KeeperHub had no Superfluid actions. We built and upstreamed a native plugin so any KH workflow can `createPool`, `updateMemberUnits`, `distributeFlow` without bespoke contract calls.

- **PR:** [KeeperHub#1106 — `feat: add Superfluid protocol`](https://github.com/KeeperHub/keeperhub/pull/1106) (12 commits, base `KeeperHub/keeperhub:staging`, head `Philotheephilix:feat/superfluid-protocol`).
- Specification: [`PRD-2-superfluid-plugin.md`](../../PRD-2-superfluid-plugin.md) at the repo root.
- Driver/consumer: [`orchestrator/economics.py`](../../orchestrator/economics.py) — every Superfluid call we make is structured to match the plugin's action shape, so the same orchestrator switches to the plugin once the PR merges.

### 3. Upstream PR — Coalition plugin (multi-party on-chain commitments with slashing)

KeeperHub had no native primitive for "N parties commit on-chain to do a thing; if any breach, the keeper slashes." That's the core of any operator coalition that touches money. We built a **Coalition plugin** that gives KeeperHub a first-class multi-party commitment + enforcement primitive.

- **PR:** [KeeperHub#1105 — `feat: add Coalition plugin (multi-party on-chain commitments with slashing)`](https://github.com/KeeperHub/keeperhub/pull/1105) (18 commits, base `KeeperHub/keeperhub:staging`, head `Philotheephilix:feat/KEEP-XXX-coalition-plugin`).
- Specification: [`PRD-1-coalition-plugin.md`](../../PRD-1-coalition-plugin.md) at the repo root.
- Use case in this product: the slashing path (workflow #5 — `compute-coalition-handle-breach`) records a breach against the coalition, slashes the breaching operator's stake, and zeroes their `updateMemberUnits` so they stop earning instantly.

### 4. x402 + streaming = one workflow primitive

The shape every API economy lands on — **pay once to start, then pay per second while you use it** — is fragmented across two protocols. KeeperHub is the right abstraction layer to bond them.

- x402 voucher gate: [`orchestrator/x402.py`](../../orchestrator/x402.py) + [`facilitator/`](../../facilitator/) (the relayer that submits `transferWithAuthorization`).
- The orchestrator validates the x402 voucher → triggers the KH `stream-start` workflow → KH calls `GDA distributeFlow` on the on-chain Coalition pool → operators earn USDCx by the second.
- When the request closes (EOS or client disconnect), the orchestrator triggers `stream-stop`. The meter halts to the second.

Effect: an agent in any framework can `POST /v1/chat/completions` with one signed x402 voucher and **the entire downstream payment lifecycle, including continuous streaming, runs through KeeperHub workflows**.

### 5. Agent autopay via x402 + KeeperHub MCP

Per the KH brief, agents pay autonomously via **x402** in our integration. Our OpenAI-compatible router ([`orchestrator/api/openai_compat.py`](../../orchestrator/api/openai_compat.py) + [`orchestrator/api/openai_auth.py`](../../orchestrator/api/openai_auth.py)) returns HTTP 402 with the x402 challenge; the agent signs and replays. Once admitted, KeeperHub takes over the payout side of the meter.

---

## How this improves KeeperHub

| Before ComputePool | After |
|---|---|
| KH has no native streaming-money action — workflows pay in single transfers only. | Superfluid plugin ([PR #1106](https://github.com/KeeperHub/keeperhub/pull/1106)) — native `createPool`, `updateMemberUnits`, `distributeFlow` actions. |
| KH has no primitive for multi-party on-chain commitments with slashing. | Coalition plugin ([PR #1105](https://github.com/KeeperHub/keeperhub/pull/1105)) — N parties commit, the keeper enforces and slashes any that breach. |
| KH integrates with x402 for inbound payments only. No reference for combining x402 with continuous payouts. | First product wiring x402 → KeeperHub → Superfluid as a single agent-pays-per-call-then-per-second flow. |
| KH integrations are mostly DeFi-flavored. | First AI-infrastructure deployment of KH — execution layer for an actual GPU coalition. |

---

## Track qualification

This packet covers both KeeperHub focus areas (one ranked prize pool).

### 🟢 Focus Area 1 — Best Innovative Use of KeeperHub

> *"Show us something we haven't seen before. Use KeeperHub's execution layer in a way that solves a real problem."*

- **Real problem:** N untrusted GPU operators must be paid per second of work, slashed if they cheat, and unbonded when the request ends — without any single one of them holding custody. KeeperHub workflows are the system of record for every state transition.
- **Novel application:** AI infrastructure as a KeeperHub citizen. The product fails without KH; this isn't a bolt-on.
- **Depth:** five workflows, all firing in production for the demo, with webhook verification round-tripping back to the orchestrator.

### 🟢 Focus Area 2 — Best Integration with KeeperHub

> *"Integrate KeeperHub with payment rails like x402 or MPP. Show how agents can pay for services, settle transactions, or route payment flows into KeeperHub execution."*

- **Both halves of agent payments wired in.** x402 for atomic session open. Superfluid for per-second metering. KeeperHub orchestrates the boundary between them.
- **Plus a framework integration:** the OpenAI-compatible router ([`orchestrator/api/openai_compat.py`](../../orchestrator/api/openai_compat.py)) means any LangChain / CrewAI / OpenAgents client speaks to ComputePool with no SDK — and the back end runs through KH.
- **Plus two upstream contributions:** Superfluid plugin ([#1106](https://github.com/KeeperHub/keeperhub/pull/1106)) + Coalition plugin ([#1105](https://github.com/KeeperHub/keeperhub/pull/1105)). We didn't just integrate, we extended.

### 🔍 Builder Feedback Bounty (also applicable)

We have specific, actionable feedback from building these workflows during the hackathon — UX friction, doc gaps, MCP behavior under retries — and would happily file it. See `docs/keeperhub-build-notes.md` (TBD if requested).

---

## How to verify

```sh
# 1. Re-import the five workflows in your KH org
#    Edit each JSON to replace integrationId + coalition_address, then upload via KH dashboard.

# 2. Bring up the stack
make build && make up
docker compose up -d facilitator

# 3. Point an ngrok tunnel at the orchestrator so KH can reach your webhooks
ngrok http 8000 # then set ORCHESTRATOR_PUBLIC_URL in .env

# 4. Run the end-to-end demo
DEMO_PAYER_KEY=0x... python scripts/e2e_demo.py
```

Watch the orchestrator logs: every state transition (`coalition_proposed`, `payment_pool_ready`, `stream_started`, `stream_stopped`) is a webhook from a KeeperHub workflow run.

---

## File index — every file that touches KeeperHub

```
keeperhub/                                       Five workflow JSON exports
keeperhub/README.md                              Re-import instructions + workflow IDs
orchestrator/keeperhub.py                        KH MCP / JSON-RPC client
orchestrator/economics.py                        Drives the workflows; consumes the Superfluid plugin shape
orchestrator/webhooks.py                         KH webhook receiver (state-transition callbacks)
orchestrator/webhook_verifier.py                 HMAC verification of KH webhook signatures
orchestrator/x402.py                             x402 paywall (the inbound rail KH integrates with)
orchestrator/api/openai_compat.py                OpenAI-compat router with x402 challenge
orchestrator/api/openai_auth.py                  Per-call auth flow for OpenAI-compat
facilitator/                                     x402 facilitator (relayer)
PRD-1-coalition-plugin.md                        Coalition plugin spec (upstream PR #1105)
PRD-2-superfluid-plugin.md                       Superfluid plugin spec (upstream PR)
PRD-3-discom-integration.md                      Full integration design
scripts/e2e_demo.py                              End-to-end demo: x402 → KH → Superfluid → inference
```

---

## Open PRs (live)

| PR | Title | Commits | Branch |
|---|---|---:|---|
| [`KeeperHub/keeperhub#1106`](https://github.com/KeeperHub/keeperhub/pull/1106) | `feat: add Superfluid protocol` | 12 | `Philotheephilix:feat/superfluid-protocol` → `staging` |
| [`KeeperHub/keeperhub#1105`](https://github.com/KeeperHub/keeperhub/pull/1105) | `feat: add Coalition plugin (multi-party on-chain commitments with slashing)` | 18 | `Philotheephilix:feat/KEEP-XXX-coalition-plugin` → `staging` |

Both PRs reference `computepool.vercel.app` as the live dogfooding deployment. Same URLs are wired into the pitch deck PR badges (`frontend/app/pitch/page.tsx`, search for `PRBadge`).
