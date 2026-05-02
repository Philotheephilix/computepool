from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from web3 import Web3

from .chain import Chain
from .keeperhub import KeeperHubClient, WorkflowInputs
from .models import CoalitionState
from .settings import Settings


logger = logging.getLogger("discom.economics")


class EconomicsService:
    def __init__(
        self,
        db,
        kh: KeeperHubClient,
        chain: Chain | None,
        settings: Settings,
        http: httpx.AsyncClient,
    ):
        self.db = db
        self.kh = kh
        self.chain = chain
        self.settings = settings
        self.http = http

    @staticmethod
    def compute_terms_hash(pool_config: dict) -> str:
        canonical = "|".join(
            [
                pool_config["model_name"],
                json.dumps(pool_config["layer_split"], separators=(",", ":")),
                str(pool_config["stake_amount_wei"]),
                str(pool_config["deadline_unix"]),
            ]
        )
        return "0x" + Web3.keccak(text=canonical).hex().removeprefix("0x")

    async def on_pool_initialize(
        self,
        pool: dict,
        participants: list[str],
        stake_amount_wei: int,
        deadline_unix: int,
    ) -> str:
        """Persist a Coalition row and trigger the form workflow.

        Returns the coalition document id.
        """
        coalition_id = str(uuid.uuid4())
        terms_hash = self.compute_terms_hash(
            {
                "model_name": pool.get("model") or pool.get("model_name"),
                "layer_split": pool.get("layer_split")
                or [a.get("layers") for a in (pool.get("assignments") or [])],
                "stake_amount_wei": stake_amount_wei,
                "deadline_unix": deadline_unix,
            }
        )
        now = datetime.now(timezone.utc)
        deadline = datetime.fromtimestamp(deadline_unix, tz=timezone.utc)
        await self.db.coalitions.insert_one(
            {
                "_id": coalition_id,
                "pool_id": str(pool["_id"]),
                "onchain_id": None,
                "terms_hash": terms_hash,
                "participants": participants,
                "signatures": {},
                "stake_per_party": str(stake_amount_wei),
                "state": CoalitionState.PROPOSED.value,
                "deadline": deadline,
                "created_at": now,
                "tx_hashes": {},
            }
        )

        await self.kh.execute_workflow(
            self.settings.kh_workflow_coalition_form,
            inputs=WorkflowInputs.coalition_form(
                session_id=coalition_id,
                participants=participants,
                terms_hash=terms_hash,
                deadline_unix=deadline_unix,
                stake_token=self.settings.usdc_address,
                stake_per_party=str(stake_amount_wei),
                callback_url=self.settings.public_url.rstrip("/")
                + "/webhooks/keeperhub",
            ),
        )
        logger.info("coalition.form workflow started session_id=%s", coalition_id)
        return coalition_id

    async def on_coalition_proposed(self, payload: dict) -> None:
        """Webhook: KH says coalition is on-chain. Drive signature collection.

        Branch A (M5 implements `/coalition/sign-onchain` on each worker):
        each worker submits its own on-chain `Coalition.sign(coalitionId)` tx.
        The coalition workflow polls `coalition.check-status` and moves to
        activate once all signatures land.
        """
        coalition_id = payload["session_id"]
        onchain_id = int(payload["onchain_id"])
        await self.db.coalitions.update_one(
            {"_id": coalition_id},
            {
                "$set": {
                    "onchain_id": onchain_id,
                    "tx_hashes.propose": payload.get("tx_hash"),
                }
            },
        )
        coalition = await self.db.coalitions.find_one({"_id": coalition_id})
        nodes = await self.db.nodes.find(
            {"wallet_address": {"$in": coalition["participants"]}}
        ).to_list(length=None)

        sig_txs: dict[str, str] = {}
        for node in nodes:
            url = f"{node['worker_url'].rstrip('/')}/coalition/sign-onchain"
            r = await self.http.post(
                url,
                json={
                    "coalition_onchain_id": onchain_id,
                    "coalition_address": self.settings.coalition_address,
                    "stake_token": self.settings.usdc_address,
                    "stake_amount": str(coalition.get("stake_per_party", "0")),
                },
                timeout=120.0,  # tx + receipt can take ~30s
            )
            r.raise_for_status()
            sig_txs[node["wallet_address"]] = r.json()["tx_hash"]

        await self.db.coalitions.update_one(
            {"_id": coalition_id}, {"$set": {"sign_txs": sig_txs}}
        )

    async def on_coalition_activated(self, payload: dict) -> None:
        coalition_id = payload["session_id"]
        await self.db.coalitions.update_one(
            {"_id": coalition_id},
            {
                "$set": {
                    "state": CoalitionState.ACTIVE.value,
                    "tx_hashes.activate": payload.get("tx_hash"),
                }
            },
        )
        logger.info("coalition activated session_id=%s", coalition_id)

    async def on_payment_pool_ready(self, payload: dict) -> None:
        """Webhook: GDA pool created and member units assigned.

        Tells each worker to connectPool from its own key.
        """
        coalition_id = payload["session_id"]
        coalition = await self.db.coalitions.find_one({"_id": coalition_id})
        pool_address = payload["pool_address"]
        await self.db.payment_pools.update_one(
            {"pool_id": coalition["pool_id"]},
            {
                "$set": {
                    "superfluid_pool_address": pool_address,
                    "super_token": payload.get(
                        "super_token", self.settings.usdcx_address
                    ),
                    "state": "ready",
                }
            },
            upsert=True,
        )

        nodes = await self.db.nodes.find(
            {"wallet_address": {"$in": coalition["participants"]}}
        ).to_list(length=None)
        for node in nodes:
            url = f"{node['worker_url'].rstrip('/')}/coalition/connect-pool"
            try:
                r = await self.http.post(
                    url, json={"pool_address": pool_address}, timeout=30.0
                )
                r.raise_for_status()
                logger.info(
                    "worker connect-pool ok node=%s tx=%s",
                    node["node_id"],
                    r.json().get("tx_hash"),
                )
            except Exception as e:
                logger.error(
                    "worker connect-pool failed node=%s err=%s",
                    node["node_id"],
                    e,
                )

    async def on_breach_detected(
        self,
        *,
        pool_id: str,
        party: str,
        evidence_uri: str,
        evidence_hash: str,
    ) -> None:
        """Stub for this slice. Logs only."""
        logger.warning(
            "breach detected (stub) pool=%s party=%s evidence=%s",
            pool_id,
            party,
            evidence_uri,
        )
