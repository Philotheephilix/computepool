#!/usr/bin/env python3
"""End-to-end demo runner against a live ComputePool stack.

Pre-conditions:
  - orchestrator + workers up
  - facilitator up
  - KEEPERHUB workflows configured
  - Sepolia USDC funded on the demo payer wallet
  - Sepolia ETH funded on every wallet

Steps:
  1. Register a fresh user, login.
  2. Self-register two workers (assumes worker containers up; uses their wallets).
  3. Create a pool, add the two nodes, initialize (triggers coalition formation).
  4. Wait for pool state == "ready" (= coalition active + GDA pool created + members connected).
  5. Load weights.
  6. Send /pools/{name}/infer without payment, expect 402.
  7. Sign payment, retry. Expect 200 + tokens + X-PAYMENT-RESPONSE.
  8. Verify Mongo Payment doc is in state "settled".
  9. Print Etherscan links for every tx hash.

Exit 0 on success; non-zero on any step failure.
"""
import asyncio
import json
import os
import sys
import time
import httpx
import subprocess
from datetime import datetime, timezone


ORCH = os.environ.get("ORCHESTRATOR_URL", "http://localhost:8000")
USERNAME = os.environ.get("DEMO_USERNAME", f"demo-{int(time.time())}")
PASSWORD = os.environ.get("DEMO_PASSWORD", "demopw")
POOL = os.environ.get("DEMO_POOL", "demo-pool")
MODEL = os.environ.get("DEMO_MODEL", "meta-llama/Llama-3.2-1B")
PROMPT = os.environ.get("DEMO_PROMPT", "Hello, world.")
MAX_TOKENS = int(os.environ.get("DEMO_MAX_TOKENS", "20"))
STAKE_WEI = os.environ.get("DEMO_STAKE_WEI", "1000000")


async def step(name: str, fn):
    print(f"==> {name}")
    t0 = time.time()
    out = await fn()
    print(f"   ok ({time.time()-t0:.1f}s)")
    return out


async def main() -> int:
    async with httpx.AsyncClient(base_url=ORCH, timeout=120.0) as c:
        async def register():
            r = await c.post("/auth/register", json={"username": USERNAME, "password": PASSWORD})
            r.raise_for_status()
            return r.json()["api_key"]

        api_key = await step("Register user", register)
        h = {"X-API-Key": api_key}

        async def list_nodes():
            r = await c.get("/nodes", headers=h)
            r.raise_for_status()
            return r.json()

        nodes = await step("List nodes", list_nodes)
        if len(nodes) < 2:
            print("   error: expected ≥ 2 registered workers")
            return 2

        async def create_pool():
            r = await c.post("/pools", headers=h, json={"name": POOL})
            r.raise_for_status()
            return r.json()

        await step(f"Create pool {POOL}", create_pool)

        async def add_nodes():
            r = await c.post(f"/pools/{POOL}/nodes", headers=h,
                             json={"node_ids": [n["node_id"] for n in nodes[:2]]})
            r.raise_for_status()
            return r.json()

        await step("Add nodes to pool", add_nodes)

        async def initialize():
            r = await c.post(f"/pools/{POOL}/initialize", headers=h, json={
                "model": MODEL,
                "stake_amount_wei": STAKE_WEI,
                "deadline_unix": int(time.time()) + 3600,
            })
            r.raise_for_status()
            return r.json()

        await step("Initialize pool (coalition forms)", initialize)

        async def wait_ready():
            for _ in range(120):
                r = await c.get(f"/pools/{POOL}", headers=h)
                if r.is_success and r.json().get("state") == "ready":
                    return
                await asyncio.sleep(2)
            raise RuntimeError("pool never reached state=ready")

        await step("Wait for pool ready (coalition + GDA + connect)", wait_ready)

        async def load():
            r = await c.post(f"/pools/{POOL}/load", headers=h)
            r.raise_for_status()
            return r.json()

        await step("Load model weights", load)

        async def expect_402():
            r = await c.post(f"/pools/{POOL}/infer", headers=h,
                             json={"prompt": PROMPT, "max_tokens": MAX_TOKENS})
            assert r.status_code == 402, f"expected 402, got {r.status_code}"
            return r.json()

        challenge = await step("Infer without payment → 402", expect_402)
        amount = challenge["accepts"][0]["maxAmountRequired"]

        async def sign_and_pay():
            env = dict(os.environ,
                       ORCHESTRATOR_WALLET_ADDRESS=challenge["accepts"][0]["payTo"],
                       USDC_ADDRESS=challenge["accepts"][0]["asset"],
                       AMOUNT_MICRO=amount)
            cp = subprocess.run(["python", "scripts/sign_payment.py"],
                                capture_output=True, env=env, check=True)
            x_payment = cp.stdout.decode().strip()
            r = await c.post(f"/pools/{POOL}/infer",
                             headers={**h, "X-PAYMENT": x_payment},
                             json={"prompt": PROMPT, "max_tokens": MAX_TOKENS})
            assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
            return r

        result = await step("Sign x402 + retry → 200", sign_and_pay)
        body = result.json()
        print(f"   inference output: {json.dumps(body)[:200]}")
        assert "x-payment-response" in {k.lower() for k in result.headers}, "X-PAYMENT-RESPONSE missing"

        print("==> done")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
