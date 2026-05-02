# KeeperHub workflow exports

Reference exports of the four (+ one placeholder) workflows that drive the ComputePool × KeeperHub × Superfluid × x402 demo. Use these to re-import the workflows in a fresh KeeperHub organization.

| File | Workflow ID (this org) | Purpose |
|------|------------------------|---------|
| `compute-coalition-propose.workflow.json` | `1tmtaw7r4u2nr0hpt3kgf` | `Coalition.propose(...)` then HTTP POST `coalition_proposed` |
| `compute-coalition-activate-and-pool.workflow.json` | `8mah6alp4w5a1eb4eqj6s` | `Coalition.activate` → `GDA createPool` → 2× `updateMemberUnits` → POST `payment_pool_ready` |
| `compute-coalition-stream-start.workflow.json` | `i4loo42c2uv66stpmxuw0` | `GDA distributeFlow` at requested rate → POST `stream_started` |
| `compute-coalition-stream-stop.workflow.json` | `y0tztp0kv2ke5szdu8arp` | `GDA distributeFlow` rate=0 → POST `stream_stopped` |
| `compute-coalition-handle-breach.workflow.json` | `lg2mw6be5tck0scx1zxcv` | (placeholder, disabled) `recordBreach` → `slash` → `updateMemberUnits` to 0 → POST `breach_slashed` |

## Re-importing in a new org

The exports include the wallet `integrationId` from this org. Before importing, replace every `"integrationId": "<id>"` with your own wallet integration's ID, and update the trigger inputs / `coalition_address` to match your deployed `Coalition.sol`.

## Orchestrator coordination

The orchestrator (`orchestrator/economics.py`) drives the demo as follows:

1. `POST /pools/{n}/initialize` → `EconomicsService.on_pool_initialize` → KH `compute-coalition-propose`
2. KH posts back `coalition_proposed` → `on_coalition_proposed`:
   - Updates `coalitions.onchain_id` in Mongo
   - Drives each worker's `/coalition/sign-onchain` (parallel, `asyncio.gather`)
   - Once all sigs land, triggers KH `compute-coalition-activate-and-pool`
3. KH posts back `coalition_activated` (intermediate, optional) and `payment_pool_ready` → `on_payment_pool_ready`:
   - Persists `pool_address` in Mongo
   - Drives each worker's `/coalition/connect-pool` (parallel)
4. `POST /pools/{n}/infer` → x402 verify → `on_payment_received` → KH `compute-coalition-stream-start`
5. KH posts back `stream_started`, orchestrator runs inference (existing AXL flow), then KH `compute-coalition-stream-stop`
6. KH posts back `stream_stopped` → orchestrator x402 settles → response

## Webhook callback URL

All five workflows POST callbacks to `{{trigger.body.callback_url}}` — the orchestrator passes `${PUBLIC_URL}/webhooks/keeperhub` per execution. The webhook handler verifies HMAC-SHA256 against `KEEPERHUB_WEBHOOK_SECRET`.

## ABIs

ABIs are inlined in each `web3/write-contract` action. The Coalition.sol ABI is hand-rolled; the GDAv1Forwarder ABI is hand-rolled because there's no verified deployment of Superfluid on 0G Galileo yet. The manual ABIs work regardless of explorer verification.
