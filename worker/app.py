from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import httpx
import torch
from eth_account import Account
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .axl_client import AXLClient
from .coalition_sign import router as coalition_router
from .model import SplitModel
from .pipeline import (
    EntryDispatcher,
    entry_generate,
    entry_generate_iter,
    entry_recv_loop,
    exit_loop,
)
from .settings import get_settings as get_worker_settings


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("worker")


class ConfigureRequest(BaseModel):
    role: str = Field(..., pattern="^(entry|exit)$")
    layers: List[int]
    model: str
    peer_id: str = Field(..., pattern="^[0-9a-fA-F]{64}$")


class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 64
    request_id: Optional[str] = None
    temperature: float = 0.0


def _select_dtype() -> torch.dtype:
    forced = os.environ.get("TORCH_DTYPE", "").lower()
    if forced == "float32":
        return torch.float32
    return torch.bfloat16


def _detect_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.settimeout(0.5)
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return ""


async def _register_with_orchestrator(app: FastAPI) -> None:
    state = app.state
    orch_url: Optional[str] = state.orchestrator_url
    if not orch_url:
        logger.info("ORCHESTRATOR_URL unset; skipping registration")
        return
    api_key = state.owner_api_key
    if not api_key:
        logger.error("OWNER_API_KEY is not set; refusing to register.")
        return

    url = f"{orch_url.rstrip('/')}/nodes/register"
    headers = {"X-API-Key": api_key}

    async with httpx.AsyncClient(timeout=10.0) as client:
        attempt = 0
        while True:
            attempt += 1
            try:
                peer = state.axl.our_peer_id()
                ipv6 = state.axl.our_ipv6()
            except Exception as e:
                logger.warning("AXL not ready for register (attempt %d): %r", attempt, e)
                peer, ipv6 = "", ""
            if not peer:
                await asyncio.sleep(5.0)
                continue

            try:
                ws = get_worker_settings()
                wallet_address = Account.from_key(ws.worker_private_key).address
            except Exception as e:
                logger.warning("worker settings/wallet not available: %r", e)
                wallet_address = None

            payload = {
                "node_id": state.node_id,
                "axl_peer_id": peer,
                "axl_ipv6": ipv6,
                "ip_address": state.ip_address,
                "worker_url": state.worker_url,
            }
            if wallet_address:
                payload["wallet_address"] = wallet_address
            try:
                r = await client.post(url, json=payload, headers=headers)
                if 200 <= r.status_code < 300:
                    logger.info("registered with orchestrator: %s (attempt %d)", url, attempt)
                    state.registered = True
                    return
                if r.status_code in (401, 403):
                    logger.error(
                        "orchestrator rejected registration: HTTP %d %s (check OWNER_API_KEY)",
                        r.status_code, r.text[:200],
                    )
                    return
                logger.warning("orchestrator register HTTP %d: %s", r.status_code, r.text[:200])
            except Exception as e:
                logger.warning("orchestrator register failed (attempt %d): %r", attempt, e)
            try:
                await asyncio.sleep(5.0)
            except asyncio.CancelledError:
                return


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = app.state

    s.node_id = os.environ.get("NODE_ID", "node-unknown")
    s.worker_url = os.environ.get("WORKER_URL", "http://localhost:7000")
    s.orchestrator_url = os.environ.get("ORCHESTRATOR_URL", "")
    s.default_model = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-3B-Instruct")
    s.axl_api_url = os.environ.get("AXL_API_URL", "http://localhost:9002")
    s.owner_api_key = os.environ.get("OWNER_API_KEY", "")
    s.ip_address = os.environ.get("IP_ADDRESS", "") or _detect_ip()

    s.axl = AXLClient(api_url=s.axl_api_url)
    s.config: Optional[Dict[str, Any]] = None
    s.model: Optional[SplitModel] = None
    s.recv_task: Optional[asyncio.Task] = None
    s.dispatcher: Optional[EntryDispatcher] = None
    s.gen_lock = asyncio.Lock()
    s.gen_in_flight: bool = False
    s.registered: bool = False
    s.register_task: Optional[asyncio.Task] = None
    s.dtype = _select_dtype()
    s.device = "cpu"

    try:
        await asyncio.to_thread(s.axl.wait_until_ready, 30.0)
    except Exception as e:
        logger.error("AXL not ready at startup: %r", e)

    if s.orchestrator_url:
        s.register_task = asyncio.create_task(_register_with_orchestrator(app))

    try:
        yield
    finally:
        if s.recv_task is not None:
            s.recv_task.cancel()
            try:
                await s.recv_task
            except (asyncio.CancelledError, Exception):
                pass
            s.recv_task = None
        if s.model is not None:
            try:
                s.model.unload()
            except Exception:
                logger.exception("error during model.unload at shutdown")
            s.model = None
        if s.register_task is not None:
            s.register_task.cancel()
            try:
                await s.register_task
            except (asyncio.CancelledError, Exception):
                pass
        try:
            await s.axl.aclose()
        finally:
            s.axl.close()


app = FastAPI(title="dis-com worker", lifespan=lifespan)
app.include_router(coalition_router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/info")
async def info() -> dict:
    s = app.state
    cfg = s.config or {}
    try:
        peer = s.axl.our_peer_id()
    except Exception:
        peer = ""
    try:
        ipv6 = s.axl.our_ipv6()
    except Exception:
        ipv6 = ""
    return {
        "node_id": s.node_id,
        "axl_peer_id": peer,
        "axl_ipv6": ipv6,
        "role": cfg.get("role"),
        "layers": cfg.get("layers"),
        "model": cfg.get("model"),
        "loaded": bool(s.model is not None and s.model.loaded),
        "device": s.device,
        "registered": bool(s.registered),
    }


@app.post("/configure")
async def configure(req: ConfigureRequest) -> dict:
    s = app.state
    if s.model is not None:
        raise HTTPException(status_code=409, detail="model already loaded; unload before reconfiguring")
    if len(req.layers) != 2 or req.layers[0] > req.layers[1] or req.layers[0] < 0:
        raise HTTPException(
            status_code=400, detail="layers must be [start, end] with 0 <= start <= end (inclusive)"
        )
    s.config = {
        "role": req.role,
        "layers": [int(req.layers[0]), int(req.layers[1])],
        "model": req.model,
        "peer_id": req.peer_id,
    }
    logger.info("configured: %s", s.config)
    return {"ok": True, "config": s.config}


@app.post("/load")
async def load() -> dict:
    s = app.state
    if s.config is None:
        raise HTTPException(status_code=400, detail="must /configure before /load")
    if s.model is not None and s.model.loaded:
        return {"ok": True, "already_loaded": True}

    cfg = s.config
    model = SplitModel(
        model_name=cfg["model"],
        role=cfg["role"],
        layers=tuple(cfg["layers"]),
        device=s.device,
        dtype=s.dtype,
    )
    try:
        await asyncio.to_thread(model.load)
    except Exception as e:
        logger.exception("model load failed")
        raise HTTPException(status_code=500, detail=f"load failed: {e!r}") from e

    s.model = model
    peer_id = cfg.get("peer_id", "")

    if cfg["role"] == "entry":
        s.dispatcher = EntryDispatcher()
        s.recv_task = asyncio.create_task(
            entry_recv_loop(s.axl, s.dispatcher, expected_peer_id=peer_id)
        )
    else:
        s.dispatcher = None
        s.recv_task = asyncio.create_task(
            exit_loop(model, s.axl, expected_peer_id=peer_id)
        )

    return {"ok": True, "loaded": True}


@app.post("/unload")
async def unload() -> dict:
    s = app.state
    if s.recv_task is not None:
        s.recv_task.cancel()
        try:
            await s.recv_task
        except (asyncio.CancelledError, Exception):
            pass
        s.recv_task = None
    s.dispatcher = None
    if s.model is not None:
        try:
            await asyncio.to_thread(s.model.unload)
        except Exception:
            logger.exception("model unload failed (continuing)")
        s.model = None
    s.gen_in_flight = False
    return {"ok": True}


@app.post("/generate")
async def generate(req: GenerateRequest) -> dict:
    s = app.state
    if s.model is None or not s.model.loaded:
        raise HTTPException(status_code=400, detail="model not loaded")
    if s.config is None or s.config.get("role") != "entry":
        raise HTTPException(status_code=400, detail="generate is only valid on entry-role workers")
    if s.dispatcher is None:
        raise HTTPException(status_code=500, detail="entry dispatcher not initialised")

    if s.gen_in_flight:
        raise HTTPException(status_code=409, detail="another generation is already in flight")

    request_id = req.request_id or str(uuid.uuid4())
    exit_peer_id = s.config.get("peer_id", "")
    if not exit_peer_id:
        raise HTTPException(status_code=400, detail="exit peer_id not configured")

    s.gen_in_flight = True
    try:
        result = await entry_generate(
            model=s.model,
            axl=s.axl,
            exit_peer_id=exit_peer_id,
            dispatcher=s.dispatcher,
            prompt=req.prompt,
            max_tokens=int(req.max_tokens),
            temperature=float(req.temperature),
            request_id=request_id,
        )
    finally:
        s.gen_in_flight = False

    return result


@app.post("/generate/stream")
async def generate_stream(req: GenerateRequest):
    s = app.state
    if s.model is None or not s.model.loaded:
        raise HTTPException(status_code=400, detail="model not loaded")
    if s.config is None or s.config.get("role") != "entry":
        raise HTTPException(status_code=400, detail="generate is only valid on entry-role workers")
    if s.dispatcher is None:
        raise HTTPException(status_code=500, detail="entry dispatcher not initialised")
    if s.gen_in_flight:
        raise HTTPException(status_code=409, detail="another generation is already in flight")

    request_id = req.request_id or str(uuid.uuid4())
    exit_peer_id = s.config.get("peer_id", "")
    if not exit_peer_id:
        raise HTTPException(status_code=400, detail="exit peer_id not configured")

    s.gen_in_flight = True

    async def event_stream():
        try:
            async for ev in entry_generate_iter(
                model=s.model,
                axl=s.axl,
                exit_peer_id=exit_peer_id,
                dispatcher=s.dispatcher,
                prompt=req.prompt,
                max_tokens=int(req.max_tokens),
                temperature=float(req.temperature),
                request_id=request_id,
            ):
                yield f"data: {json.dumps(ev)}\n\n"
        except Exception as e:
            logger.exception("generate_stream failed req=%s", request_id)
            yield f"data: {json.dumps({'event': 'error', 'request_id': request_id, 'error': repr(e)})}\n\n"
        finally:
            s.gen_in_flight = False

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering (nginx/CF)
        },
    )


__all__ = ["app"]
