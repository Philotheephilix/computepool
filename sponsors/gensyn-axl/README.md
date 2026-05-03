# Gensyn — AXL sponsor judging packet

> **TL;DR.** ComputePool is the **first production deployment of layer-pipelined LLM inference over AXL**. Hidden states cross AXL frames; sampled tokens come back the same way. Multi-node by construction. Packaged as prebuilt **NVIDIA + CPU Docker images** so an operator brings up a worker with one command. Networked over **Tailscale** so operators expose **zero public ports** while AXL still gets the encrypted P2P link it expects.

> *"What Gensyn drew on the whiteboard, we put in production."* — pitch deck, slide 8.

---

## What we shipped on AXL

### 1. Layer-pipelined inference is the AXL workload

A real LLM is a stream of transformer blocks. We split that stream across two workers and let AXL carry the activations between them, **per token**:

- [`worker/pipeline.py`](../../worker/pipeline.py) — `entry_generate` runs `forward_entry`, packs the output hidden-state tensor with [`framing.pack_tensor`](../../worker/framing.py), calls `axl.send` to the exit peer, then waits on the `EntryDispatcher` queue for the sampled token to come back. `exit_loop` runs as an async task on the other side: poll `axl.recv`, run `forward_exit`, sample the next token, `axl.send` it back.
- [`worker/axl_client.py`](../../worker/axl_client.py) — thin HTTP wrapper around the AXL daemon's `/send`, `/recv`, `/topology` endpoints. `send` is synchronous (called via `asyncio.to_thread`); `recv` is async-polling.
- [`worker/framing.py`](../../worker/framing.py) — binary wire format: 4-byte LE header length, JSON header, raw bytes. **bfloat16 is round-tripped via `uint8` view** because numpy lacks bfloat16 — a non-obvious detail that matters for any AI workload on AXL.

This is **not** a hello-world AXL demo. It's a tight per-token loop carrying hundreds of MB of activations every second on real models.

### 2. Multi-node by construction (qualification requirement)

> *AXL judging requirement: "Must demonstrate communication across separate AXL nodes, not just in-process."*

The whole product collapses if the two shards run in one process. Our architecture mandates two independent worker containers, each with its own AXL daemon:

- `make up` brings up `node-a` and `node-b` as separate Docker containers.
- Each runs its own AXL daemon on `:7001`; they discover each other via `PEER_HOST` / `PEER_ADDR`.
- Add a third worker on a separate host with one command: [`scripts/run-remote-worker.sh`](../../scripts/run-remote-worker.sh).
- Hidden states genuinely cross the network — verified with `tcpdump` on the AXL port in any deployment.

### 3. One-line deploy via prebuilt NVIDIA + CPU images

The biggest friction in shipping AXL today is the build step. We removed it.

- [`docker/Dockerfile`](../../docker/Dockerfile) is multi-stage: Go for the AXL daemon, Python for the worker, tagged as `dis-com:latest`.
- [`docker-compose.yml`](../../docker-compose.yml) wires orchestrator + node-a + node-b together.
- [`docker-compose.gpu.yml`](../../docker-compose.gpu.yml) and [`docker-compose.gpu-extra.yml`](../../docker-compose.gpu-extra.yml) overlay NVIDIA runtime + CUDA wheels.
- For an operator joining an existing cluster: `./scripts/run-remote-worker.sh --node-id node-c --orchestrator https://... --worker-url https://... --peer node-a.example.com:7001` — that's the entire onboarding.

### 4. Tailscale-native — zero exposed ports

Gaming GPUs sit behind home routers. Asking operators to forward ports is a non-starter. We mesh the cluster over Tailscale so AXL still gets the routable peer address it needs **without** the operator opening anything to the public internet:

- [`docker-compose.tailscale.yml`](../../docker-compose.tailscale.yml) — Tailscale sidecar, AXL bound to the tailnet interface only.
- AXL's `PEER_ADDR` is set to the peer's `100.x.x.x` Tailscale IP.
- Net result: operators run a worker on a residential ISP, **0 ports open to the public internet**, AXL handshake still completes peer-to-peer, all traffic is WireGuard-encrypted on top of AXL's own ed25519 TLS.

### 5. Honest AXL detail — what we hit and how we worked around it

- AXL's default TCP port is `7000`, which collides with the worker's HTTP port. We override AXL to `7001` in the generated `node-config.json` (see `worker/app.py` startup). Documented in the root README troubleshooting section.
- AXL ed25519 keys are auto-generated per worker. There is **no peer allowlist yet** — anyone who reaches `:7001` and presents a valid TLS handshake can become a peer. We accept this for the hackathon; the Tailscale overlay limits exposure in practice.

---

## How this improves AXL adoption

| Before ComputePool | After |
|---|---|
| AXL examples are toy agent-to-agent chat; no production AI workload reference. | Reference implementation of the AXL workload most builders will want — **layer-pipelined LLM inference**. |
| AXL onboarding requires a Go toolchain + manual node-config wrangling. | One-line deploy via `docker compose up dis-com` with prebuilt NVIDIA + CPU images. |
| AXL needs routable peer addresses → operators expose ports. | Tailscale recipe + compose file → zero exposed ports, mesh-routed AXL. |
| Wire format for tensor data on AXL is undocumented. | [`worker/framing.py`](../../worker/framing.py) is a clean reusable bf16-safe pack/unpack — drop it into any AXL-on-AI project. |

---

## Track qualification

> *"Must use AXL for inter-agent or inter-node communication (no centralised message broker replacing what AXL provides). Must demonstrate communication across separate AXL nodes, not just in-process. Project must be built during the hackathon."*

| Requirement | How we satisfy it |
|---|---|
| **Use AXL for inter-node communication** | Every hidden-state hop and every sampled token between entry and exit shards goes over AXL `/send` + `/recv`. The orchestrator never relays activations. |
| **No centralized broker replacing AXL** | The orchestrator is HTTP control plane only — `configure`, `load`, `unload`, `generate`. Inference data plane is exclusively AXL P2P. |
| **Communication across separate AXL nodes** | Each worker is a separate container with its own AXL daemon on its own host network namespace. Tested with workers on physically separate hosts via `scripts/run-remote-worker.sh`. |
| **Built during the hackathon** | Git history reflects this. |

> *Judging criteria: "Depth of AXL integration · Quality of code · Clear documentation · Working examples"*

| Criterion | Evidence |
|---|---|
| Depth | Per-token AXL roundtrip carrying tensor activations. Custom binary framing for bf16. Async dispatcher pattern. |
| Quality | Typed, async, unit-tested. See [`worker/tests/`](../../worker/tests/). |
| Documentation | This file + root README + pitch deck slide 5 (sequence diagram of the AXL hop). |
| Working examples | `make up` brings the cluster online in <60 s. `scripts/e2e_demo.py` runs an end-to-end inference. |

---

## How to verify

```sh
# 1. Bring up two AXL nodes locally
make build && make up
make ps              # node-a and node-b should both be Up

# 2. Watch AXL handshake
make logs-a | grep -i axl
make logs-b | grep -i axl

# 3. Run inference and watch hidden states cross
curl -X POST http://localhost:8000/pools/demo/infer \
     -H "X-API-Key: $KEY" -d '{"prompt":"hello","max_tokens":20}'

# 4. (Optional) tcpdump on the AXL port to prove activations are on the wire
docker compose exec node-a tcpdump -i any port 7001 -nn
```

To prove **multi-node across hosts**, use the remote worker script:

```sh
./scripts/run-remote-worker.sh \
    --node-id node-c \
    --orchestrator http://orchestrator-host:8000 \
    --worker-url   http://this-host:7000 \
    --peer         node-a.example.com:7001
```

---

## File index — every file that touches AXL

```
worker/axl_client.py                AXL HTTP client (send / recv / topology)
worker/framing.py                   Binary wire format (header + raw tensor bytes, bf16-safe)
worker/pipeline.py                  entry_generate / exit_loop — per-token AXL hops
worker/app.py                       Worker FastAPI; spawns AXL daemon, wires PEER_ADDR
worker/coalition_sign.py            Coalition signing over AXL-attested identity
docker/Dockerfile                   Multi-stage: Go for AXL daemon + Python for worker
docker-compose.yml                  orchestrator + node-a + node-b
docker-compose.gpu.yml              NVIDIA runtime overlay
docker-compose.tailscale.yml        Tailscale sidecar for zero-port operator deploy
scripts/run-remote-worker.sh        One-line deploy of an additional worker on a remote host
```
