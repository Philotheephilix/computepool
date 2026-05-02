# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (orchestrator / worker)

```sh
# Run orchestrator locally (requires MongoDB)
cd orchestrator && pip install -r requirements.txt
uvicorn orchestrator.app:app --host 0.0.0.0 --port 8000 --reload

# Run a worker locally
cd worker && pip install -r requirements.txt
NODE_ID=node-a WORKER_URL=http://localhost:7000 ORCHESTRATOR_URL=http://localhost:8000 \
  OWNER_API_KEY=<key> PEER_HOST=<other-host> uvicorn worker.app:app --host 0.0.0.0 --port 7000
```

### Docker (primary dev workflow)

```sh
make build       # build dis-com:latest (multi-stage: Go/AXL + Python/app)
make up          # start orchestrator + node-a + node-b
make logs        # tail all logs
make logs-a      # tail node-a only
make ps          # check container health
make clean       # stop + remove volumes + remove image
```

### Frontend

```sh
cd frontend
npm install
npm run dev      # dev server at localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

## Architecture

### System overview

```
user / web → orchestrator :8000 (FastAPI, MongoDB)
                 ↓ HTTP control plane
           node-a :7000          node-b :7000
           (entry worker)        (exit worker)
           AXL daemon :7001 ←→ AXL daemon :7001  (P2P TLS)
```

A **pool** is a named inference cluster of exactly 2 workers. The **entry** worker holds layers 0..mid-1 (embed + first half); the **exit** holds layers mid..N-1 (second half + lm_head). Hidden states travel entry→exit over AXL; sampled tokens travel exit→entry over AXL. All control (configure, load, unload, generate) goes HTTP through the orchestrator.

### Inference token loop

`entry_generate` in `worker/pipeline.py`:
1. Tokenize prompt → `forward_entry` → hidden states tensor
2. Serialize tensor with `framing.pack_tensor` (4-byte LE header_len + JSON header + raw bytes) → `axl.send` to exit peer
3. Wait on `EntryDispatcher` queue for a token int back from AXL
4. Append token, run next `forward_entry` step with that token, repeat until EOS or max_tokens
5. Send a `control/end` frame to signal the exit to drop its KV cache

`exit_loop` in `worker/pipeline.py` runs as a background asyncio task:
- Receives hidden state frames via `axl.recv` polling
- Calls `forward_exit` → samples next token (`sample_next_token`)
- Sends token back via `axl.send` to the from-peer address

Both sides maintain `DynamicCache` (HuggingFace KV cache) keyed by `request_id`; the cache is dropped on `unload` or receipt of a `control/end` frame.

### Worker internals

- `worker/model.py`: `SplitModel` — loads only the assigned layer slice from a full HuggingFace `AutoModelForCausalLM`. Entry keeps `embed_tokens + layers[start:mid]`; exit keeps `layers[mid:end] + norm + lm_head`. Tied lm_head/embed_tokens weights are detached on exit to survive `del full`.
- `worker/axl_client.py`: thin HTTP wrapper around the AXL daemon's `/send`, `/recv`, `/topology` endpoints. `send` is synchronous (called via `asyncio.to_thread`); `recv` is async-polling.
- `worker/framing.py`: binary wire format shared by both sides — `pack`/`unpack` for generic frames, `pack_tensor`/`unpack_tensor` for hidden states (bfloat16 is round-tripped via uint8 view because numpy lacks bfloat16).

### Orchestrator internals

- `orchestrator/app.py`: FastAPI with a background `healthcheck_loop` that polls `/info` on every registered worker every 10 s and marks workers unhealthy after 3 consecutive failures.
- `orchestrator/db.py`: Motor (async MongoDB). Three collections: `users`, `nodes`, `pools`. Unique indexes on `(owner_username, node_id)` and `(owner_username, name)`.
- Auth: `X-API-Key` header; keys are generated on registration and stored hashed alongside `password_hash`.
- Pool state machine: `registered → configured → loaded`. Only `loaded` pools can run inference. Changing pool membership resets `initialized` to false.

### Frontend

Next.js **16** with React 19 and Tailwind CSS v4. **This is not the Next.js you know from training data** — APIs and conventions differ. Read `node_modules/next/dist/docs/` before writing Next.js-specific code.

Route structure:
- `app/page.tsx` — landing page
- `app/connect/` — wallet connect flow
- `app/(app)/` — authenticated shell with shared sidebar (`AppNav`) and page padding (`AppPage`)
  - `marketplace/` — shard grid (`MarketplaceClient`, `ShardCard`, `ShardDrawer`)
  - `jobs/` — job list and detail pages
  - `wallet/` — INFT wallet and reputation

Demo/animation data lives in `frontend/lib/` (`marketplace.ts`, `pipeline.ts`) and the `useDemoLoop` hook drives the animated states.

### Supported models

| Model | Total layers | Split |
|---|---|---|
| `meta-llama/Llama-3.2-1B` | 16 | 0–7 / 8–15 |
| `meta-llama/Llama-3.2-3B` | 28 | 0–13 / 14–27 |
| `Qwen/Qwen2.5-3B-Instruct` | 36 | 0–17 / 18–35 |
| `Qwen/Qwen3-4B-Instruct-2507` | 36 | 0–17 / 18–35 |

The split is always `total // 2`. To add a new model, add it to `MODEL_LAYERS` in `orchestrator/app.py`.

## Git conventions

- Do **not** add `Co-Authored-By: Claude` (or any AI model) lines to commit messages.
- Do not commit files under `docs/superpowers/` or any `PRD-*.md` files — they are gitignored by design.

## Constraints

- Single in-flight generation per cluster — `gen_in_flight` flag in worker state. Concurrent `/infer` calls get HTTP 409.
- Worker callbacks (`/configure`, `/load`, `/unload`, `/generate`) are **unauthenticated**. Never expose worker ports publicly.
- CPU-only by default. The bundled `torch` wheel is the CPU build; swap it in `worker/requirements.txt` for the correct CUDA wheel to enable GPU.
- AXL port is overridden to `7001` (away from the worker's `7000`) in the container's generated `node-config.json`. Don't change this.
- `PEER_HOST` or `PEER_ADDR` is required; single-worker mode is not supported.
