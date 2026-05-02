# dis-com

Distributed LLM inference. Split a transformer across two Docker containers, talk over [AXL](https://github.com/gensyn-ai/axl), and control the cluster from a single orchestrator API.

## Architecture

```
                   +-------------------+
   user / web ---> |   orchestrator    |  :8000  (FastAPI, dashboard, /pools/*/infer)
                   +---------+---------+
                             | HTTP control plane
                +------------+------------+
                |                         |
        +-------v--------+        +-------v--------+
        |    node-a      |        |    node-b      |
        |  worker :7000  |        |  worker :7000  |
        |  (entry, L0..) |        |  (exit,  L..N) |
        |                |        |                |
        |  AXL daemon    | <====> |  AXL daemon    |   tls://...:7001  (P2P)
        |  api :9002     |        |  api :9002     |
        +----------------+        +----------------+
```

Hidden states flow worker -> AXL -> peer worker; all control plane (configure, load, generate) is HTTP from the orchestrator.

## Quick start (local, two containers)

```sh
make build           # build the dis-com image (multi-stage: Go for AXL, Python for app)
make up              # start orchestrator + node-a + node-b
make ps              # confirm three containers are Up
```

Then open <http://localhost:8000>, register a user, copy the API key, and re-run the workers with `OWNER_API_KEY=<key>` set so they self-register. From the dashboard: create a pool, add the two nodes, initialize with a model + price, load, then run inference.

The first `/pools/{name}/load` downloads roughly 6 GB of weights into the shared `hf-cache` volume; subsequent loads are fast because the cache survives container restarts.

To tear everything down (including volumes and the image):

```sh
make clean
```

## Dashboard

Open <http://localhost:8000> for the orchestrator's web dashboard (live cluster state).

## Running a remote worker

To add a third worker on a separate host:

```sh
./scripts/run-remote-worker.sh \
    --node-id node-c \
    --orchestrator http://orchestrator-host.example.com:8000 \
    --worker-url   http://this-host.example.com:7000 \
    --peer         node-a.example.com:7001
```

The image (`dis-com:latest`) must already be built or pulled on the remote host. `--peer` accepts either `host:port` or a full `tls://host:port` URL; the script wires it into `PEER_ADDR` so AXL connects to that exact address. Pass `--dry-run` to see the resulting `docker run` command without executing it.

## Choosing a different model

Pick a model when you initialize a pool from the dashboard (or `POST /pools/{name}/initialize`). The orchestrator computes an even layer split automatically.

Supported models:

| Model | Layers | Split |
|---|---|---|
| `meta-llama/Llama-3.2-1B` | 16 | 0-7 / 8-15 |
| `meta-llama/Llama-3.2-3B` | 28 | 0-13 / 14-27 |
| `Qwen/Qwen2.5-3B-Instruct` | 36 | 0-17 / 18-35 |
| `Qwen/Qwen3-4B-Instruct-2507` | 36 | 0-17 / 18-35 |

Unload (or delete) the pool before re-initializing with a different model.

## Configuration reference (worker container)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ID` | yes | - | Stable id this worker registers as (`node-a`, `node-b`, ...) |
| `WORKER_URL` | yes | - | Base URL the orchestrator should call back on |
| `ORCHESTRATOR_URL` | yes | - | Base URL of the orchestrator |
| `OWNER_API_KEY` | yes | - | API key of the user owning this worker (from the dashboard) |
| `MODEL_NAME` | no | `Qwen/Qwen2.5-3B-Instruct` | HuggingFace model id |
| `AXL_API_URL` | no | `http://localhost:9002` | AXL HTTP API (in-container) |
| `PEER_HOST` | one of these two | - | Hostname of the other worker; expanded to `tls://${PEER_HOST}:7001` |
| `PEER_ADDR` | one of these two | - | Full peer URL (e.g. `tls://1.2.3.4:7001`); takes precedence over `PEER_HOST` |

The orchestrator container reads `MONGODB_URI` and `MONGODB_DB`.

## API reference (orchestrator)

All endpoints except `/`, `/health`, `/api/models`, `/auth/*` require `X-API-Key`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | HTML dashboard |
| `GET` | `/api/state` | JSON cluster snapshot for the caller |
| `POST` | `/auth/register` | Create user, returns API key |
| `POST` | `/auth/login` | Returns API key for an existing user |
| `GET` | `/nodes`, `GET /nodes/{id}`, `DELETE /nodes/{id}` | Node CRUD |
| `POST` | `/nodes/register` | (called by workers on startup) |
| `POST` | `/pools`, `GET /pools`, `GET /pools/{n}`, `DELETE /pools/{n}` | Pool CRUD |
| `POST` | `/pools/{n}/nodes`, `DELETE /pools/{n}/nodes/{id}` | Pool membership |
| `POST` | `/pools/{n}/initialize` | Assign model + layer split + USDC price |
| `POST` | `/pools/{n}/load`, `/pools/{n}/unload` | Load/unload weights on members |
| `POST` | `/pools/{n}/infer` | Generate text end-to-end |

## Troubleshooting

- **Workers don't register.** Check that `ORCHESTRATOR_URL` is reachable from the worker container (`docker compose exec node-a curl -sf $ORCHESTRATOR_URL/api/state`). On Docker for Mac/Windows pointing at a host orchestrator, use `host.docker.internal`.
- **AXL peers don't connect.** Confirm port `7001/tcp` is reachable peer-to-peer and that `PEER_HOST`/`PEER_ADDR` resolves to the right address. `make logs-a` and `make logs-b` will show AXL handshake errors.
- **AXL port clash.** AXL's default TCP port is 7000, which collides with the worker. The image overrides this to 7001 in the generated `node-config.json` — don't change it.
- **OOM during `load`.** Pick a smaller model (Llama-3.2-1B has 16 layers and fits in <4 GB RAM) or give Docker more memory. Default precision is bfloat16 on CPU.
- **Slow inference.** Expected. CPU-only execution and every token round-trips through both nodes over AXL. Throughput on a typical laptop is single-digit tokens/sec.
- **First `load` hangs.** It's downloading. Watch `make logs-a` to see HuggingFace progress.
- **"PEER_HOST must be set" on startup.** You started the worker container without setting one of `PEER_HOST` or `PEER_ADDR`. Standalone (single-worker) mode is not supported in v1.

## Limitations

- Single in-flight generation per cluster (no batching, no parallel requests).
- KV cache lives in worker RAM only; it is dropped on `unload` or container restart.
- Worker callbacks (`/configure`, `/load`, `/unload`, `/generate`) are unauthenticated. Don't expose worker ports to the public internet.
- CPU-only by default. The image works on GPU hosts but the bundled `torch==2.5.1` wheel is the CPU build; swap it in `worker/requirements.txt` for the right CUDA wheel if you need accelerated inference.
- AXL transport is TLS-protected (ed25519 keys auto-generated per worker), but there is no peer allowlist — anyone who can reach `:7001` and present a valid TLS handshake can become a peer.

## ComputePool × KeeperHub × Superfluid × x402

This branch wires the existing sharded inference flow to the KeeperHub coalition + Superfluid plugins and gates `/pools/{n}/infer` behind a self-hosted x402 paywall. End-to-end demo lives in `scripts/e2e_demo.py`.

Prereqs:
- `Coalition.sol` deployed to 0G Galileo Testnet (chainId 16602) and the address recorded in `.env` as `COALITION_ADDRESS`.
- Superfluid Protocol deployed on 0G Galileo (Host, agreements, factories, GDAv1Forwarder, CFAv1Forwarder).
- USDC mock (FiatTokenV2-style with EIP-3009 transferWithAuthorization) deployed on 0G; USDCx wrap created via SuperTokenFactory.
- KeeperHub workflows authored in their UI (see `keeperhub/README.md` for shape) and pointed at chainId 16602.
- ngrok or similar public URL pointing at the orchestrator for KH webhooks.
- 0G testnet OG token on the orchestrator wallet, both worker wallets, and the facilitator relayer.
- USDC on the demo payer wallet (≥ 10 USDC). USDCx float on the orchestrator wallet (≥ 5 USDC wrapped).

Run:
```sh
cp .env.example .env  # fill values
make build && make up
docker compose up -d facilitator
DEMO_PAYER_KEY=0x... python scripts/e2e_demo.py
```

Architecture and design rationale: see `docs/superpowers/specs/2026-05-02-discom-keeperhub-x402-integration-design.md`.
