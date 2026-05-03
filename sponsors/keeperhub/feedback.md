# KeeperHub — Builder Feedback Bounty submission

> Specific, actionable feedback gathered while integrating KeeperHub into ComputePool ([`Philotheephilix/computepool`](https://github.com/Philotheephilix/computepool)). Covers all four bounty categories: UX/UI friction, reproducible bugs, documentation gaps, and feature requests.

**Integration surface in this project:**
- KH MCP/JSON-RPC client at [`orchestrator/keeperhub.py`](../../orchestrator/keeperhub.py)
- Five workflow JSON exports under [`keeperhub/`](../../keeperhub/) — `propose`, `activate-and-pool`, `stream-start`, `stream-stop`, `handle-breach`
- Two upstream PRs against `KeeperHub/keeperhub:staging`: [#1106 Superfluid plugin](https://github.com/KeeperHub/keeperhub/pull/1106) (12 commits) and [#1105 Coalition plugin (multi-party on-chain commitments with slashing)](https://github.com/KeeperHub/keeperhub/pull/1105) (18 commits)
- HMAC-verified webhook receiver at [`orchestrator/webhooks.py`](../../orchestrator/webhooks.py) + [`orchestrator/webhook_verifier.py`](../../orchestrator/webhook_verifier.py)

---

## 1. UX & UI friction

### 1.1 The `/mcp` channel is the only path, and it isn't documented as a public API

KH workflows are advertised via the dashboard, MCP marketing, and CLI docs, but there is **no stable, documented HTTP contract for triggering Manual workflow executions from a server-side process**. The dashboard and the MCP server share an internal JSON-RPC path at `/mcp` that we had to reverse-engineer.

The only way to fire `propose / activate-and-pool / stream-start / stream-stop / handle-breach` from the orchestrator is `/mcp` + a session bootstrap dance. We documented our findings inline at the top of [`orchestrator/keeperhub.py`](../../orchestrator/keeperhub.py) — that comment exists because there was nothing to link to.

**Ask.** Either promote `/mcp` to a stable, versioned public contract (with a `Content-Type` policy, error-shape spec, and an OpenAPI/JSON-Schema document), or ship a parallel REST surface for "trigger Manual workflow + poll status." Right now every integrator burns the same 2–3 hours discovering the same shape.

### 1.2 Response shape ambiguity — JSON vs SSE on `tools/call`

`tools/call` returns `Content-Type: application/json` *or* `text/event-stream` for the same logical call. Clients must branch on `Content-Type`, buffer the body, and parse `data:` lines. First integration burned time on `JSONDecodeError` before noticing streaming frames. Our `_call_tool` ended up doing exactly this dual-parse for the same reason; the comment block above it is longer than the function body.

**Ask.** Pick one default for synchronous `tools/call` responses, or document prominently: *"Always send `Accept: application/json, text/event-stream` and implement the dual parser."* Ship a minimal reference client (Python + TypeScript) in the docs sidebar.

### 1.3 Session bootstrap ordering (`mcp-session-id` + `notifications/initialized`)

Successful calls require:

1. `POST /mcp` with `method: initialize` → read `mcp-session-id` response header
2. `POST /mcp` with `method: notifications/initialized` **with that header**
3. Only then `tools/call`

If step 2 is skipped, reordered, or the session id omitted, failures are opaque (generic 4xx/5xx, or empty `tool` content). We added an `asyncio.Lock` to serialise the first call after observing partial-init races under parallel kickoff.

**Ask.** A one-screen "MCP-over-HTTP checklist" diagram (initialize → initialized → tools/call) with required headers highlighted, plus the **exact error** the server returns for each mistake.

### 1.4 Polling ergonomics — `get_direct_execution_status`

`execute_transfer` returns an `executionId`, but a **terminal logical state** can arrive **before** `transactionHash` is populated. Naive integrators stop on `status=completed` and ship a broken receipt.

**Ask.** Document the state machine explicitly: allowed `status` values, which combinations include `transactionHash`, recommended poll intervals. A tiny state diagram would prevent a class of bugs.

### 1.5 Workflow-export portability

Workflow JSON exports are great but reference the **source org's `integrationId`**. Right now we instruct users to `sed` through the JSON (see [`keeperhub/README.md`](../../keeperhub/README.md) — "Re-importing in a new org" section).

**Ask.** Either rewrite `integrationId` references at import time (with a UI prompt: "map source integration X → which of your wallets?"), or surface a `kh export --portable` CLI flag that strips org-specific IDs and replaces them with named placeholders.

---

## 2. Reproducible bugs / sharp edges

### 2.1 "Completed" without `transactionHash` (polling required)

**Observed.** First `execute_transfer` response sometimes reports a success-class status without a `transactionHash`. Polling `get_direct_execution_status` with the same `execution_id` later yields the hash.

**Why it matters.** Any agent that gates the next step on "I have a tx hash" deadlocks or fails. We gate the AXL stream-start workflow on the `payment_pool_ready` callback; missing `transactionHash` in that callback would have produced silent stream-start with no on-chain pool — exactly the kind of "looks fine, breaks later" bug.

**Mitigation we shipped.** Loop until timeout; treat missing hash as incomplete.

**Server-side ask.** Either always block `execute_transfer` until the hash is known, or return a distinct `status` like `confirming` until `transactionHash` is present so clients don't misread `completed`.

### 2.2 Tool-result envelope is deeply nested and sometimes non-JSON text

Path in practice: `result.content[0].text` → sometimes JSON string, sometimes empty, sometimes non-JSON. Clients that `json.loads` blindly will crash. We ship a defensive parser that wraps non-JSON as `{"_raw": text}`.

**Ask.** Publish a JSON Schema for the **MCP tool response wrapper** (not just business payload) so generated clients don't have to guess the envelope.

### 2.3 Web3 write paths hang on 0G

`web3/write-contract` calls submitted via KH workflows hang silently on 0G Galileo (chainId 16602) under the conditions we tested — see the `TODO(KH-issue)` markers in [`orchestrator/economics.py`](../../orchestrator/economics.py). Workaround: our orchestrator submits the five write transactions (`Coalition.propose / activate`, `GDA createPool / updateMemberUnits / distributeFlow`) **directly via web3.py** using `ORCHESTRATOR_PRIVATE_KEY`, bypassing the KH write path entirely.

**Ask.** Either confirm KH `web3/write-contract` is not yet supported on non-canonical chains (chainId list), or surface a clear timeout + retry policy so clients don't infinite-loop. We'd happily switch back to the KH write path once it works on 0G — bypassing it loses the audit trail KH otherwise provides.

---

## 3. Documentation gaps

### 3.1 Per-tool parameter schemas

We inferred parameter names for `web3/write-contract`, `web3/read-contract`, `webhook/post`, `execute_transfer`, and `get_direct_execution_status` from experimentation and error messages. The MCP marketing pages explain *that* tools exist, not the **exact argument object** each tool expects.

**Ask.** One page per tool: required fields, types, constraints, example `tools/call` JSON bodies, and example **success + error** payloads (both JSON and SSE variants).

### 3.2 Testnet / sandbox story

Under hackathon pressure, teams need a **documented** path: which chain(s), which USDC address per chain, faucet links, rate limits, whether the same `app.keeperhub.com/mcp` URL is correct for test, expected tx latency band, and a "hackathon quickstart" env-var matrix.

For 0G Galileo specifically, document the chainId list KH considers "testnet" and whether the canonical USDC address (or an EIP-3009 mock) is the recommended default.

### 3.3 Receipt verification & trust model

Docs should state:

- What `signed_receipt` / `executionId` attests to
- How a **callee** can verify independently (explorer link? calldata decode? signed attestation?)
- Enumeration of all `status` values returned by polling

### 3.4 CLI for workflow-run inspection during dev

Tracing a failing workflow run through the dashboard is slower than tailing the orchestrator's webhook receiver logs. We ended up debugging via app logs rather than the KH dashboard.

**Ask.** `kh runs tail <workflow_id>` or `kh runs show <run_id>` from the existing CLI — even just JSON dumps of the run's step-by-step inputs/outputs/errors.

---

## 4. Feature requests

| # | Feature | Why |
|---|---|---|
| 1 | **`simulate: true` / `dry_run` on transfers** | Validate args + return mock `executionId` / receipt without sending a tx. Critical for CI and for LLM agents that need to rehearse flows. |
| 2 | **Structured errors everywhere** — `{ "code", "detail", "hint" }` | Replace generic messages for: unknown tool, bad chain, insufficient balance, invalid token, missing session header. Our `KeeperHubError` class would simplify dramatically with this. |
| 3 | **Webhook / SSE subscribe on execution id** | Push terminal state + `transactionHash` instead of exponential backoff. Reduces client complexity and the "completed-without-hash" race in §2.1. |
| 4 | **Published workflow discovery** | If KH workflows are first-class, expose a search/list API so third parties can discover reusable patterns ("inbound toll", "stream start/stop") without DMing the workflow author. |
| 5 | **Optional channel credit / off-chain debit pattern** | For sub-second agent routing, document an off-chain debit that doesn't block every inbound negotiation on cold-chain latency. |
| 6 | **ENS + KeeperHub cookbook** | Short recipe: store workflow id + treasury wallet in ENS text records; caller resolves ENS → calls MCP → passes receipt hash forward. |
| 7 | **First-class Superfluid plugin** — *we shipped this as [PR #1106](https://github.com/KeeperHub/keeperhub/pull/1106)* | Streaming payouts are increasingly the right shape for agent economies; without a native plugin every team duplicates `createPool / updateMemberUnits / distributeFlow` boilerplate against the GDA forwarder. |
| 8 | **First-class multi-party commitment + slashing primitive** — *we shipped this as [PR #1105](https://github.com/KeeperHub/keeperhub/pull/1105)* | KH workflows run individually — no native primitive for "N parties commit on-chain to do a thing; if any breach, the keeper slashes." Useful far beyond our use case (any workflow that orchestrates an N-party agreement, anti-collusion vote, or quorum-gated action). |
| 9 | **Portable workflow export with org-id rewriting** | See §1.5 — `kh export --portable` would close the team-handoff gap. |

---

## 5. What worked well (balance)

- **MCP as the integration boundary** fits agent tooling mental models. Once parsing/session issues are solved, wrapping a KH tool in an agent orchestrator is straightforward.
- **`executionId` + poll** is a simple reliability primitive vs. rolling our own nonce/gas/retry logic on hackathon timelines.
- **Webhook retry semantics + HMAC verification are excellent** — no notes. Our `webhook_verifier.py` HMAC validation passed every retry without tweaks.
- **The dashboard UX is excellent** for understanding what a workflow does at design time. The friction is purely on the API/automation side.
- **Workflow JSON exports** as a re-importable artifact is the right product shape — just needs the portability fixes in §1.5.

---

## 6. Summary table — bounty mapping

| Bounty category | This document |
|---|---|
| **UX / UI friction** | §1.1 `/mcp` not public · §1.2 JSON/SSE · §1.3 init ordering · §1.4 polling · §1.5 export portability |
| **Reproducible bugs** | §2.1 "completed" without tx-hash · §2.2 envelope shape · §2.3 web3 write hangs on 0G |
| **Documentation gaps** | §3.1 per-tool schemas · §3.2 testnet matrix · §3.3 receipt verification · §3.4 dev-time run CLI |
| **Feature requests** | §4 — 9 items, two of which we shipped as PRs ([#1106](https://github.com/KeeperHub/keeperhub/pull/1106) Superfluid, [#1105](https://github.com/KeeperHub/keeperhub/pull/1105) Coalition) |

---

*Submitted as honest builder feedback during ETHGlobal Open Agents. Amounts and rules on the hackathon prize page supersede any figures cited elsewhere.*
