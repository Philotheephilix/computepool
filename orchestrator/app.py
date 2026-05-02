from __future__ import annotations

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pymongo.errors import DuplicateKeyError

from . import db
from .auth import (
    generate_api_key,
    get_current_user,
    hash_password,
    verify_password,
)
from .api.infer import build_router as build_infer_router
from .chain import Chain
from .economics import EconomicsService
from .keeperhub import KeeperHubClient
from .settings import get_settings
from .webhooks import build_router as build_webhooks_router
from .models import (
    AuthResponse,
    LoginRequest,
    MeResponse,
    NodeRegisterRequest,
    NodeRegisterResponse,
    PoolAddNodesRequest,
    PoolCreateRequest,
    PoolInitializeRequest,
    RegisterRequest,
    node_to_response,
    pool_to_response,
)


logger = logging.getLogger("dis-com.orchestrator")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


MODEL_LAYERS: dict[str, int] = {
    "Qwen/Qwen2.5-3B-Instruct": 36,
    "Qwen/Qwen3-4B-Instruct-2507": 36,
    "meta-llama/Llama-3.2-1B": 16,
    "meta-llama/Llama-3.2-3B": 28,
}

WORKER_TIMEOUT_DEFAULT = 30.0
WORKER_TIMEOUT_LOAD = 600.0
WORKER_TIMEOUT_INFO = 3.0
HEALTHCHECK_INTERVAL_S = 10.0


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _compute_assignments(model: str, node_ids: list[str]) -> list[dict]:
    if model not in MODEL_LAYERS:
        raise HTTPException(400, f"Unknown model {model!r}; known: {sorted(MODEL_LAYERS)}")
    if len(node_ids) != 2:
        raise HTTPException(400, "Pool must have exactly 2 nodes to initialize.")
    total = MODEL_LAYERS[model]
    mid = total // 2
    return [
        {"node_id": node_ids[0], "role": "entry", "layers": [0, mid - 1]},
        {"node_id": node_ids[1], "role": "exit", "layers": [mid, total - 1]},
    ]


async def _poll_node(http: httpx.AsyncClient, node: dict) -> None:
    obj_id = node["_id"]
    worker_url = node.get("worker_url") or ""
    if not worker_url:
        return
    url = worker_url.rstrip("/") + "/info"
    try:
        r = await http.get(url, timeout=WORKER_TIMEOUT_INFO)
        r.raise_for_status()
        info = r.json()
    except Exception as exc:
        logger.debug("healthcheck failed for %s: %s", node.get("node_id"), exc)
        await db.nodes().update_one(
            {"_id": obj_id},
            [
                {"$set": {"fail_count": {"$add": [{"$ifNull": ["$fail_count", 0]}, 1]}}},
                {
                    "$set": {
                        "status": {
                            "$cond": [
                                {"$gte": ["$fail_count", 3]},
                                "unhealthy",
                                "$status",
                            ]
                        }
                    }
                },
            ],
        )
        return

    role = info.get("role")
    layers = info.get("layers")
    model = info.get("model")
    loaded = bool(info.get("loaded"))
    if loaded:
        new_status = "loaded"
    elif role is not None:
        new_status = "configured"
    else:
        new_status = "registered"

    await db.nodes().update_one(
        {"_id": obj_id},
        {
            "$set": {
                "last_seen": _now(),
                "fail_count": 0,
                "role": role,
                "layers": layers,
                "model": model,
                "status": new_status,
            }
        },
    )


async def _reconcile_pool_loaded() -> None:
    """If any member of a 'loaded' pool isn't loaded, flip pool.loaded back to false."""
    cursor = db.pools().find({"loaded": True})
    async for pool in cursor:
        owner = pool["owner_username"]
        node_ids = pool.get("node_ids") or []
        if not node_ids:
            continue
        members = await db.nodes().find(
            {"owner_username": owner, "node_id": {"$in": node_ids}}
        ).to_list(length=10)
        if len(members) < len(node_ids) or any(m.get("status") != "loaded" for m in members):
            await db.pools().update_one(
                {"_id": pool["_id"]},
                {"$set": {"loaded": False, "updated_at": _now()}},
            )


async def healthcheck_loop(app: FastAPI) -> None:
    http: httpx.AsyncClient = app.state.http
    while True:
        try:
            nodes_list = await db.nodes().find({}).to_list(length=10_000)
            await asyncio.gather(
                *[_poll_node(http, n) for n in nodes_list],
                return_exceptions=True,
            )
            await _reconcile_pool_loaded()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("healthcheck loop iteration failed")
        await asyncio.sleep(HEALTHCHECK_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    database = await db.init_db()
    await db.ensure_economic_indexes(database)
    app.state.http = httpx.AsyncClient(timeout=WORKER_TIMEOUT_DEFAULT)

    # Economics wiring (KH client, on-chain reader, EconomicsService)
    try:
        settings = get_settings()
        kh = KeeperHubClient(
            api_key=settings.keeperhub_api_key,
            base_url=settings.keeperhub_base_url,
        )
        chain = Chain(
            rpc_url=settings.sepolia_rpc_url,
            chain_id=settings.chain_id,
            usdcx_address=settings.usdcx_address,
            gda_forwarder=settings.gda_v1_forwarder,
            coalition_address=settings.coalition_address,
        )
        # TODO(KH-issue): direct on-chain submitter that bypasses KH for the
        # five write actions (Coalition.propose / activate, GDA createPool /
        # updateMemberUnits / distributeFlow). KH's web3 write path hangs on
        # 0G Galileo (Cloudflare 524 after 124s, no tx broadcast). Remove this
        # and the `onchain=` wiring below once KH ships the 0G fix.
        from .onchain import OnchainSubmitter
        onchain = OnchainSubmitter(
            rpc_url=settings.sepolia_rpc_url,
            chain_id=settings.chain_id,
            private_key=settings.orchestrator_private_key,
            coalition_address=settings.coalition_address,
            gda_forwarder=settings.gda_v1_forwarder,
        )
        app.state.kh = kh
        app.state.chain = chain
        app.state.onchain = onchain
        app.state.economics = EconomicsService(
            db=database,
            kh=kh,
            chain=chain,
            settings=settings,
            http=app.state.http,
            onchain=onchain,
        )
        app.include_router(build_webhooks_router(app.state.economics))
        app.include_router(
            build_infer_router(
                economics=app.state.economics,
                run_inference=run_inference,
                load_pool=_load_pool_for_infer,
                http=app.state.http,
            ),
        )
    except Exception:
        logger.exception("failed to initialize EconomicsService; continuing without it")
        app.state.economics = None

    task = asyncio.create_task(healthcheck_loop(app), name="healthcheck-loop")
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
        kh = getattr(app.state, "kh", None)
        if kh is not None:
            try:
                await kh.aclose()
            except Exception:
                pass
        await app.state.http.aclose()
        await db.close_db()


app = FastAPI(title="dis-com orchestrator", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMPLATES_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/api/models")
async def api_models():
    return dict(MODEL_LAYERS)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/auth/register", response_model=AuthResponse)
async def auth_register(body: RegisterRequest):
    api_key = generate_api_key()
    doc = {
        "username": body.username,
        "password_hash": hash_password(body.password),
        "api_key": api_key,
        "created_at": _now(),
    }
    try:
        await db.users().insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists.")
    return AuthResponse(username=body.username, api_key=api_key)


@app.post("/auth/login", response_model=AuthResponse)
async def auth_login(body: LoginRequest):
    user = await db.users().find_one({"username": body.username})
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials.")
    return AuthResponse(username=user["username"], api_key=user["api_key"])


@app.get("/auth/me", response_model=MeResponse)
async def auth_me(user: dict = Depends(get_current_user)):
    return MeResponse(username=user["username"])


@app.post("/nodes/register", response_model=NodeRegisterResponse)
async def nodes_register(
    body: NodeRegisterRequest,
    user: dict = Depends(get_current_user),
):
    owner = user["username"]
    existing = await db.nodes().find_one({"owner_username": owner, "node_id": body.node_id})

    update = {
        "ip_address": body.ip_address,
        "axl_peer_id": body.axl_peer_id,
        "axl_ipv6": body.axl_ipv6,
        "worker_url": body.worker_url,
        "wallet_address": body.wallet_address,
        "status": "registered",
        "fail_count": 0,
        "last_seen": None,
    }
    if existing is None:
        update.update({
            "owner_username": owner,
            "node_id": body.node_id,
            "registered_at": _now(),
            "pool_name": None,
            "role": None,
            "layers": None,
            "model": None,
        })
        try:
            await db.nodes().insert_one(update)
        except DuplicateKeyError:
            raise HTTPException(status.HTTP_409_CONFLICT, "Node already registered.")
    else:
        await db.nodes().update_one({"_id": existing["_id"]}, {"$set": update})

    logger.info("registered node %s @ %s for user=%s", body.node_id, body.worker_url, owner)
    return NodeRegisterResponse(ok=True, owner=owner)


@app.get("/nodes")
async def nodes_list(user: dict = Depends(get_current_user)):
    docs = await db.nodes().find({"owner_username": user["username"]}).to_list(length=10_000)
    return [node_to_response(d) for d in docs]


async def _owned_node(node_id: str, user: dict) -> dict:
    doc = await db.nodes().find_one({"owner_username": user["username"], "node_id": node_id})
    if doc is None:
        raise HTTPException(404, f"node {node_id!r} not found")
    return doc


@app.get("/nodes/{node_id}")
async def nodes_get(node_id: str, user: dict = Depends(get_current_user)):
    return node_to_response(await _owned_node(node_id, user))


@app.delete("/nodes/{node_id}")
async def nodes_delete(node_id: str, user: dict = Depends(get_current_user)):
    doc = await _owned_node(node_id, user)
    if doc.get("pool_name"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"node is currently in pool {doc['pool_name']!r}; remove from pool first.",
        )
    await db.nodes().delete_one({"_id": doc["_id"]})
    return {"ok": True}


async def _owned_pool(name: str, user: dict) -> dict:
    pool = await db.pools().find_one({"owner_username": user["username"], "name": name})
    if pool is None:
        raise HTTPException(404, f"pool {name!r} not found")
    return pool


def _split_results(results: list[tuple[str, dict | Exception]]) -> tuple[dict, list[dict]]:
    acks: dict[str, dict] = {}
    errors: list[dict] = []
    for nid, res in results:
        if isinstance(res, Exception):
            errors.append({"node": nid, "error": str(res)})
        else:
            acks[nid] = res
    return acks, errors


async def _post_one(http: httpx.AsyncClient, node: dict, path: str, timeout_s: float, json_body: dict | None = None) -> tuple[str, dict | Exception]:
    url = (node.get("worker_url") or "").rstrip("/") + path
    try:
        r = await http.post(url, json=json_body, timeout=timeout_s)
        r.raise_for_status()
        return node["node_id"], (r.json() if r.content else {"ok": True})
    except Exception as exc:
        return node["node_id"], exc


async def _broadcast_to_pool(
    app: FastAPI,
    pool: dict,
    path: str,
    timeout_s: float,
) -> tuple[dict, list[dict]]:
    http: httpx.AsyncClient = app.state.http
    node_ids: list[str] = pool.get("node_ids", [])
    nodes_docs = await db.nodes().find(
        {"owner_username": pool["owner_username"], "node_id": {"$in": node_ids}}
    ).to_list(length=10)
    results = await asyncio.gather(*[_post_one(http, n, path, timeout_s) for n in nodes_docs])
    return _split_results(results)


@app.post("/pools")
async def pools_create(body: PoolCreateRequest, user: dict = Depends(get_current_user)):
    now = _now()
    doc = {
        "name": body.name,
        "owner_username": user["username"],
        "node_ids": [],
        "model": None,
        "price_per_token_usdc": None,
        "currency": "USDC",
        "initialized": False,
        "loaded": False,
        "assignments": None,
        "created_at": now,
        "updated_at": now,
    }
    try:
        await db.pools().insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, f"You already have a pool named {body.name!r}.")
    return pool_to_response(doc)


@app.get("/pools")
async def pools_list(user: dict = Depends(get_current_user)):
    docs = await db.pools().find({"owner_username": user["username"]}).to_list(length=1000)
    return [pool_to_response(d) for d in docs]


@app.get("/pools/{name}")
async def pools_get(name: str, user: dict = Depends(get_current_user)):
    return pool_to_response(await _owned_pool(name, user))


@app.delete("/pools/{name}")
async def pools_delete(name: str, user: dict = Depends(get_current_user)):
    pool = await _owned_pool(name, user)
    if pool.get("loaded"):
        acks, errors = await _broadcast_to_pool(app, pool, "/unload", WORKER_TIMEOUT_DEFAULT)
        if errors:
            return JSONResponse(
                status_code=502,
                content={
                    "error": "unload failed; pool not deleted (workers may be in inconsistent state)",
                    "details": errors,
                    "acks": acks,
                },
            )
    if pool.get("node_ids"):
        await db.nodes().update_many(
            {"owner_username": user["username"], "node_id": {"$in": pool["node_ids"]}},
            {"$set": {"pool_name": None}},
        )
    await db.pools().delete_one({"_id": pool["_id"]})
    return {"ok": True}


@app.post("/pools/{name}/nodes")
async def pools_add_nodes(
    name: str,
    body: PoolAddNodesRequest,
    user: dict = Depends(get_current_user),
):
    pool = await _owned_pool(name, user)
    if pool.get("loaded"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "pool is loaded; unload before changing membership.",
        )

    current = list(pool.get("node_ids", []))
    incoming: list[str] = []
    for nid in body.node_ids:
        if nid in current or nid in incoming:
            continue
        incoming.append(nid)

    if len(current) + len(incoming) > 2:
        raise HTTPException(400, "Pool can hold at most 2 nodes in v1.")

    for nid in incoming:
        node = await db.nodes().find_one({"owner_username": user["username"], "node_id": nid})
        if node is None:
            raise HTTPException(404, f"node {nid!r} not found")
        if node.get("pool_name"):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"node {nid!r} is already in pool {node['pool_name']!r}.",
            )
        if node.get("status") == "loaded":
            raise HTTPException(
                400, f"node {nid!r} is loaded; must be registered or configured."
            )

    if incoming:
        await db.nodes().update_many(
            {"owner_username": user["username"], "node_id": {"$in": incoming}},
            {"$set": {"pool_name": name}},
        )
        await db.pools().update_one(
            {"_id": pool["_id"]},
            {
                "$set": {
                    "node_ids": current + incoming,
                    "initialized": False,
                    "assignments": None,
                    "updated_at": _now(),
                }
            },
        )

    pool = await db.pools().find_one({"_id": pool["_id"]})
    return pool_to_response(pool)


@app.delete("/pools/{name}/nodes/{node_id}")
async def pools_remove_node(
    name: str,
    node_id: str,
    user: dict = Depends(get_current_user),
):
    pool = await _owned_pool(name, user)
    if node_id not in (pool.get("node_ids") or []):
        raise HTTPException(404, f"node {node_id!r} is not in pool {name!r}.")

    if pool.get("loaded"):
        acks, errors = await _broadcast_to_pool(app, pool, "/unload", WORKER_TIMEOUT_DEFAULT)
        await db.pools().update_one(
            {"_id": pool["_id"]},
            {"$set": {"loaded": False, "updated_at": _now()}},
        )
        if errors:
            return JSONResponse(
                status_code=502,
                content={"error": "auto-unload failed", "details": errors, "acks": acks},
            )

    new_ids = [nid for nid in pool["node_ids"] if nid != node_id]
    await db.pools().update_one(
        {"_id": pool["_id"]},
        {
            "$set": {
                "node_ids": new_ids,
                "initialized": False,
                "assignments": None,
                "updated_at": _now(),
            }
        },
    )
    await db.nodes().update_one(
        {"owner_username": user["username"], "node_id": node_id},
        {"$set": {"pool_name": None}},
    )

    pool = await db.pools().find_one({"_id": pool["_id"]})
    return pool_to_response(pool)


@app.post("/pools/{name}/initialize")
async def pools_initialize(
    name: str,
    body: PoolInitializeRequest,
    user: dict = Depends(get_current_user),
):
    pool = await _owned_pool(name, user)
    if pool.get("loaded"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "pool is loaded; unload before re-initializing.",
        )
    if body.model not in MODEL_LAYERS:
        raise HTTPException(400, f"Unknown model {body.model!r}.")
    node_ids = pool.get("node_ids") or []
    if len(node_ids) != 2:
        raise HTTPException(400, "Pool must have exactly 2 nodes to initialize.")

    nodes_docs = await db.nodes().find(
        {"owner_username": user["username"], "node_id": {"$in": node_ids}}
    ).to_list(length=2)
    by_id = {n["node_id"]: n for n in nodes_docs}
    ordered = [by_id[nid] for nid in node_ids if nid in by_id]
    if len(ordered) != 2:
        raise HTTPException(400, "One or more nodes are missing.")

    http: httpx.AsyncClient = app.state.http
    for n in ordered:
        try:
            r = await http.get(n["worker_url"].rstrip("/") + "/info", timeout=WORKER_TIMEOUT_INFO)
            r.raise_for_status()
        except Exception as exc:
            raise HTTPException(502, f"node {n['node_id']!r} /info unreachable: {exc}")

    assignments = _compute_assignments(body.model, node_ids)

    async def _configure_one(node: dict, assn: dict) -> tuple[str, dict | Exception]:
        peer = ordered[0] if node["node_id"] == ordered[1]["node_id"] else ordered[1]
        payload = {
            "role": assn["role"],
            "layers": list(assn["layers"]),
            "model": body.model,
            "peer_id": peer["axl_peer_id"],
        }
        return await _post_one(http, node, "/configure", WORKER_TIMEOUT_DEFAULT, payload)

    results = await asyncio.gather(
        _configure_one(ordered[0], assignments[0]),
        _configure_one(ordered[1], assignments[1]),
    )
    acks, errors = _split_results(results)
    if errors:
        return JSONResponse(
            status_code=502,
            content={"error": "one or more workers failed /configure", "details": errors, "acks": acks},
        )

    await db.pools().update_one(
        {"_id": pool["_id"]},
        {
            "$set": {
                "model": body.model,
                "price_per_token_usdc": body.price_per_token_usdc,
                "currency": "USDC",
                "initialized": True,
                "assignments": assignments,
                "updated_at": _now(),
            }
        },
    )
    pool = await db.pools().find_one({"_id": pool["_id"]})

    # Coalition formation: only proceed if all nodes have wallet_address.
    economics = getattr(app.state, "economics", None)
    if economics is not None:
        participants = [n["wallet_address"] for n in ordered if n.get("wallet_address")]
        if len(participants) == len(ordered):
            try:
                await economics.on_pool_initialize(
                    pool=pool,
                    participants=participants,
                    stake_amount_wei=int(body.stake_amount_wei or 0),
                    deadline_unix=int(
                        body.deadline_unix or (int(time.time()) + 3600)
                    ),
                )
            except Exception:
                logger.exception(
                    "coalition formation failed for pool=%s; pool initialize still ok",
                    name,
                )
        else:
            logger.warning(
                "skipping coalition formation for pool=%s: not all nodes have wallets",
                name,
            )

    return pool_to_response(pool)


@app.post("/pools/{name}/load")
async def pools_load(name: str, user: dict = Depends(get_current_user)):
    pool = await _owned_pool(name, user)
    if not pool.get("initialized"):
        raise HTTPException(409, "pool is not initialized.")
    acks, errors = await _broadcast_to_pool(app, pool, "/load", WORKER_TIMEOUT_LOAD)
    if errors:
        return JSONResponse(
            status_code=502,
            content={"error": "one or more workers failed /load", "details": errors, "acks": acks},
        )
    await db.pools().update_one(
        {"_id": pool["_id"]},
        {"$set": {"loaded": True, "updated_at": _now()}},
    )
    pool = await db.pools().find_one({"_id": pool["_id"]})
    return {"ok": True, "pool": pool_to_response(pool), "acks": acks}


@app.post("/pools/{name}/unload")
async def pools_unload(name: str, user: dict = Depends(get_current_user)):
    pool = await _owned_pool(name, user)
    acks, errors = await _broadcast_to_pool(app, pool, "/unload", WORKER_TIMEOUT_DEFAULT)
    await db.pools().update_one(
        {"_id": pool["_id"]},
        {"$set": {"loaded": False, "updated_at": _now()}},
    )
    if errors:
        return JSONResponse(
            status_code=502,
            content={"error": "one or more workers failed /unload", "details": errors, "acks": acks},
        )
    pool = await db.pools().find_one({"_id": pool["_id"]})
    return {"ok": True, "pool": pool_to_response(pool), "acks": acks}


async def _load_pool_for_infer(name: str, user: dict) -> dict | None:
    """Owner-scoped lookup for the 402-aware infer router.

    Synthesises a ``state`` field from the existing ``initialized`` /
    ``loaded`` booleans so the router's ``state in {"ready","loaded"}``
    check works against legacy pool docs.
    """
    pool = await db.pools().find_one(
        {"owner_username": user["username"], "name": name},
    )
    if pool is None:
        return None
    if pool.get("loaded") and pool.get("initialized"):
        pool["state"] = "loaded"
    elif pool.get("initialized"):
        pool["state"] = "initialized"
    else:
        pool["state"] = "pending"
    if pool.get("model") and not pool.get("model_name"):
        pool["model_name"] = pool["model"]
    return pool


async def run_inference(pool: dict, body: dict) -> dict:
    """Existing entry/AXL/generate flow lifted from the old infer route.

    Logic unchanged: validates entry/exit assignments + node liveness, then
    POSTs to the entry worker's ``/generate`` and returns a normalised dict.
    """
    name = pool.get("name")
    owner = pool.get("owner_username")
    if not pool.get("initialized"):
        raise HTTPException(409, "pool is not initialized.")
    if not pool.get("loaded"):
        raise HTTPException(409, "pool is not loaded.")
    assignments = pool.get("assignments") or []
    entry_assn = next((a for a in assignments if a["role"] == "entry"), None)
    exit_assn = next((a for a in assignments if a["role"] == "exit"), None)
    if entry_assn is None or exit_assn is None:
        raise HTTPException(503, "pool missing entry/exit assignment.")

    members = await db.nodes().find(
        {"owner_username": owner, "node_id": {"$in": [entry_assn["node_id"], exit_assn["node_id"]]}}
    ).to_list(length=2)
    by_nid = {m["node_id"]: m for m in members}
    entry_node = by_nid.get(entry_assn["node_id"])
    exit_node = by_nid.get(exit_assn["node_id"])
    for role, node in (("entry", entry_node), ("exit", exit_node)):
        if node is None:
            raise HTTPException(503, f"{role} node no longer registered.")
        if node.get("status") != "loaded":
            raise HTTPException(
                503,
                f"{role} node {node['node_id']!r} status={node.get('status')}; load the pool first.",
            )

    request_id = uuid.uuid4().hex
    payload = {
        "prompt": body.get("prompt"),
        "max_tokens": int(body.get("max_tokens", 64)),
        "temperature": float(body.get("temperature", 0.0)),
        "request_id": request_id,
    }
    http: httpx.AsyncClient = app.state.http
    url = entry_node["worker_url"].rstrip("/") + "/generate"
    try:
        r = await http.post(url, json=payload, timeout=WORKER_TIMEOUT_LOAD)
    except httpx.HTTPError as exc:
        raise HTTPException(502, detail={"error": str(exc), "node": entry_node["node_id"]})

    if r.status_code >= 400:
        try:
            detail = r.json()
        except Exception:
            detail = {"error": r.text}
        raise HTTPException(
            r.status_code,
            detail={"node": entry_node["node_id"], "worker_response": detail},
        )

    data = r.json()
    tokens = int(data.get("tokens") or 0)
    price = float(pool.get("price_per_token_usdc") or 0.0)

    return {
        "text": data.get("text"),
        "tokens": tokens,
        "elapsed_s": data.get("elapsed_s"),
        "tokens_per_sec": data.get("tokens_per_sec"),
        "cost_usdc": tokens * price,
        "currency": "USDC",
        "pool": name,
        "entry_node": entry_assn["node_id"],
        "exit_node": exit_assn["node_id"],
        "request_id": request_id,
        "timings": data.get("timings"),
    }


@app.get("/api/state")
async def api_state(user: dict = Depends(get_current_user)):
    nodes_docs = await db.nodes().find({"owner_username": user["username"]}).to_list(length=10_000)
    pools_docs = await db.pools().find({"owner_username": user["username"]}).to_list(length=1000)
    return {
        "user": {"username": user["username"]},
        "nodes": [node_to_response(d) for d in nodes_docs],
        "pools": [pool_to_response(d) for d in pools_docs],
        "models": dict(MODEL_LAYERS),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("orchestrator.app:app", host="0.0.0.0", port=8000, reload=False)
