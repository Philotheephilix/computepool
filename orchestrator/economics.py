from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from web3 import Web3

from .chain import Chain
from .keeperhub import KeeperHubClient, WorkflowInputs
from .models import CoalitionState, PaymentPoolState, PaymentState
from .onchain import OnchainSubmitter
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
        onchain: OnchainSubmitter | None = None,
    ):
        self.db = db
        self.kh = kh
        self.chain = chain
        self.settings = settings
        self.http = http
        # TODO(KH-issue): when KeeperHub fixes the 0G write handler this can
        # become None again and the kh.execute_workflow(...) calls should be
        # un-commented. See orchestrator/onchain.py and settings.py for the
        # full failure-mode notes.
        self.onchain = onchain

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

        # TODO(KH-issue): KeeperHub's web3/write-contract action hangs on 0G
        # Galileo (Cloudflare 524 after 124s, KH wallet nonce stays at 0).
        # Bypassing KH and submitting Coalition.propose directly via web3.py.
        # When KH ships the 0G fix, restore the kh.execute_workflow call below
        # and delete the OnchainSubmitter call + the inline on_coalition_proposed
        # invocation that synthesizes the webhook payload.
        #
        # await self.kh.execute_workflow(
        #     self.settings.kh_workflow_coalition_form,
        #     inputs=WorkflowInputs.coalition_form(
        #         session_id=coalition_id,
        #         coalition_address=self.settings.coalition_address,
        #         participants=participants,
        #         terms_hash=terms_hash,
        #         deadline_unix=deadline_unix,
        #         stake_token=self.settings.usdc_address,
        #         stake_per_party=str(stake_amount_wei),
        #         callback_url=self.settings.public_url.rstrip("/")
        #         + "/webhooks/keeperhub",
        #     ),
        # )
        if self.onchain is None:
            raise RuntimeError("onchain submitter required while KH 0G writes are broken")
        result = await self.onchain.propose(
            participants=participants,
            terms_hash=terms_hash,
            deadline_unix=deadline_unix,
            stake_token=self.settings.usdc_address,
            stake_per_party=stake_amount_wei,
        )
        logger.info(
            "coalition.propose submitted directly session_id=%s tx=%s onchain_id=%s",
            coalition_id, result["tx_hash"], result["onchain_id"],
        )
        # Synthesize the coalition_proposed webhook payload that KH would have
        # POSTed back, then drive the rest of the pipeline inline.
        asyncio.create_task(self.on_coalition_proposed({
            "session_id": coalition_id,
            "tx_hash": result["tx_hash"],
            "onchain_id": str(result["onchain_id"]) if result["onchain_id"] is not None else "",
        }))
        return coalition_id

    async def on_coalition_proposed(self, payload: dict) -> None:
        """Webhook: KH says coalition is on-chain. Drive signature collection.

        Branch A (M5 implements `/coalition/sign-onchain` on each worker):
        each worker submits its own on-chain `Coalition.sign(coalitionId)` tx.
        The coalition workflow polls `coalition.check-status` and moves to
        activate once all signatures land.
        """
        coalition_id = payload["session_id"]
        raw_onchain = (payload.get("onchain_id") or "").strip()
        if raw_onchain and raw_onchain.lstrip("-").isdigit():
            onchain_id = int(raw_onchain)
        else:
            tx_hash = payload.get("tx_hash")
            if not tx_hash or not self.chain:
                raise RuntimeError(
                    f"on_coalition_proposed: cannot resolve onchain_id "
                    f"(payload={payload!r})"
                )
            resolved = await self.chain.get_proposed_id_from_tx(tx_hash)
            if resolved is None:
                raise RuntimeError(
                    f"on_coalition_proposed: no Proposed event in tx {tx_hash}"
                )
            onchain_id = resolved
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
        participants = coalition["participants"]
        nodes = await self.db.nodes.find(
            {"wallet_address": {"$in": participants}}
        ).to_list(length=len(participants))

        async def _sign_one(node: dict) -> tuple[str, str]:
            url = f"{node['worker_url'].rstrip('/')}/coalition/sign-onchain"
            r = await self.http.post(
                url,
                json={
                    "coalition_onchain_id": onchain_id,
                    "coalition_address": self.settings.coalition_address,
                    "stake_token": self.settings.usdc_address,
                    "stake_amount": str(coalition.get("stake_per_party", "0")),
                },
                timeout=120.0,
            )
            r.raise_for_status()
            return node["wallet_address"], r.json()["tx_hash"]

        results = await asyncio.gather(
            *(_sign_one(n) for n in nodes), return_exceptions=True,
        )
        sig_txs: dict[str, str] = {}
        for node, res in zip(nodes, results):
            if isinstance(res, Exception):
                logger.error(
                    "worker sign-onchain failed node=%s err=%s",
                    node.get("node_id"), res,
                )
                continue
            addr, tx = res
            sig_txs[addr] = tx

        await self.db.coalitions.update_one(
            {"_id": coalition_id}, {"$set": {"sign_txs": sig_txs}},
        )

        # All worker sign txs have landed (each `_send_tx` waits for receipt and
        # asserts status==1). Trigger the activate-and-pool workflow now.
        if len(sig_txs) != len(participants):
            logger.error(
                "skipping activate; only %d of %d workers signed",
                len(sig_txs), len(participants),
            )
            return

        pool = await self.db.pools.find_one({"_id": coalition["pool_id"]})
        units_by_addr = self._units_by_participant(pool, participants)
        units_a = str(units_by_addr.get(participants[0], 1))
        units_b = str(units_by_addr.get(participants[1], 1)) if len(participants) > 1 else "0"
        participant_b = participants[1] if len(participants) > 1 else participants[0]

        # TODO(KH-issue): KeeperHub web3 writes hang on 0G — see settings.py /
        # onchain.py for full notes. Submitting activate + createPool +
        # updateMemberUnits×2 directly. When KH is restored, un-comment the
        # workflow trigger below and drop the OnchainSubmitter calls.
        #
        # await self.kh.execute_workflow(
        #     self.settings.kh_workflow_activate_and_pool,
        #     inputs={
        #         "session_id": coalition_id,
        #         "coalition_address": self.settings.coalition_address,
        #         "onchain_id": str(onchain_id),
        #         "super_token": self.settings.usdcx_address,
        #         "pool_admin": self.settings.orchestrator_wallet_address,
        #         "participant_a": participants[0],
        #         "units_a": units_a,
        #         "participant_b": participant_b,
        #         "units_b": units_b,
        #         "callback_url": self.settings.public_url.rstrip("/")
        #         + "/webhooks/keeperhub",
        #     },
        # )
        if self.onchain is None:
            raise RuntimeError("onchain submitter required while KH 0G writes are broken")
        activate_res = await self.onchain.activate(onchain_id=onchain_id)
        pool_res = await self.onchain.create_pool(
            super_token=self.settings.usdcx_address,
            admin=self.onchain.address,
        )
        units_a_res = await self.onchain.update_member_units(
            pool=pool_res["pool_address"],
            member=participants[0],
            units=int(units_a),
        )
        units_b_res = await self.onchain.update_member_units(
            pool=pool_res["pool_address"],
            member=participant_b,
            units=int(units_b),
        )
        logger.info(
            "activate-and-pool submitted directly session_id=%s pool=%s",
            coalition_id, pool_res["pool_address"],
        )
        asyncio.create_task(self.on_payment_pool_ready({
            "session_id": coalition_id,
            "pool_address": pool_res["pool_address"],
            "super_token": self.settings.usdcx_address,
            "activate_tx": activate_res["tx_hash"],
            "create_pool_tx": pool_res["tx_hash"],
            "units_a_tx": units_a_res["tx_hash"],
            "units_b_tx": units_b_res["tx_hash"],
        }))

    @staticmethod
    def _units_by_participant(pool: dict | None, participants: list[str]) -> dict[str, int]:
        """Derive GDA pool units per participant from the pool's layer assignments.

        units = number of layers the worker handles. Falls back to 1 unit each
        if the pool doc doesn't have explicit assignments.
        """
        if not pool or not pool.get("assignments"):
            return {addr: 1 for addr in participants}
        out: dict[str, int] = {}
        for assignment in pool["assignments"]:
            layers = assignment.get("layers")
            if not layers or len(layers) != 2:
                continue
            count = max(1, layers[1] - layers[0] + 1)
            wallet = assignment.get("wallet_address")
            if wallet:
                out[wallet] = count
        for addr in participants:
            out.setdefault(addr, 1)
        return out

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
        """Webhook: KH activate + createPool succeeded.

        KH's HTTP Request action can't surface the createPool struct return,
        so the workflow only tells us the create-pool tx hash. We extract the
        new pool address by replaying the call via eth_call, then trigger one
        ``set-member-units`` workflow per participant. The ``connectPool``
        worker fanout fires from ``on_member_units_set`` once all units land.
        """
        coalition_id = payload["session_id"]
        coalition = await self.db.coalitions.find_one({"_id": coalition_id})
        if coalition is None:
            logger.error("payment_pool_ready: no coalition for session %s", coalition_id)
            return

        pool_address = payload.get("pool_address") or ""
        if not pool_address.startswith("0x") and self.chain:
            tx = payload.get("create_pool_tx") or ""
            if tx:
                resolved = await self.chain.get_pool_from_create_tx(tx)
                if resolved:
                    pool_address = resolved
        if not pool_address.startswith("0x"):
            logger.error(
                "payment_pool_ready: cannot resolve pool address (payload=%r)",
                payload,
            )
            return

        super_token = payload.get("super_token") or self.settings.usdcx_address
        await self.db.payment_pools.update_one(
            {"pool_id": coalition["pool_id"]},
            {
                "$set": {
                    "superfluid_pool_address": pool_address,
                    "super_token": super_token,
                    "state": PaymentPoolState.INITIALIZING.value,
                    "members_set_count": 0,
                    "members_target": len(coalition["participants"]),
                }
            },
            upsert=True,
        )

        # Derive units per participant from the pool's layer assignments.
        pool = await self.db.pools.find_one({"_id": coalition["pool_id"]})
        units_by_addr = self._units_by_participant(pool, coalition["participants"])

        # TODO(KH-issue): the set-member-units workflow is no longer needed —
        # member units are set inline by the direct on-chain submission in
        # on_coalition_proposed (see the activate-and-pool block). Synthesize
        # the per-member webhook events so on_member_units_set fires and
        # connectPool fanout proceeds. When KH 0G writes are restored, fan
        # out kh.execute_workflow(kh_workflow_set_member_units) here as before.
        #
        # if not self.settings.kh_workflow_set_member_units:
        #     logger.error("KH_WORKFLOW_SET_MEMBER_UNITS not configured")
        #     return
        # for addr in coalition["participants"]:
        #     await self.kh.execute_workflow(
        #         self.settings.kh_workflow_set_member_units,
        #         inputs={...},
        #     )
        logger.info(
            "set-member-units done inline (no KH) session_id=%s pool=%s",
            coalition_id, pool_address,
        )
        for addr in coalition["participants"]:
            asyncio.create_task(self.on_member_units_set({
                "session_id": coalition_id,
                "member_address": addr,
                "tx_hash": "",  # already submitted in activate-and-pool
            }))

    async def on_member_units_set(self, payload: dict) -> None:
        """Webhook: one participant's GDA units have been set.

        After all participants are done, mark the pool READY and drive the
        worker connectPool fanout.
        """
        coalition_id = payload["session_id"]
        coalition = await self.db.coalitions.find_one({"_id": coalition_id})
        if coalition is None:
            return
        pp = await self.db.payment_pools.find_one({"pool_id": coalition["pool_id"]})
        if pp is None:
            return

        pool_address = pp["superfluid_pool_address"]
        target = pp.get("members_target") or len(coalition["participants"])

        result = await self.db.payment_pools.update_one(
            {"_id": pp["_id"]},
            {"$inc": {"members_set_count": 1}},
        )
        # Re-read to get the new count
        pp = await self.db.payment_pools.find_one({"_id": pp["_id"]})
        count = pp.get("members_set_count", 0)
        logger.info(
            "member_units_set %s (%d/%d) pool=%s",
            payload.get("member_address"), count, target, pool_address,
        )
        if count < target:
            return

        # All members assigned units — flip state and drive worker connectPool.
        await self.db.payment_pools.update_one(
            {"_id": pp["_id"]},
            {"$set": {"state": PaymentPoolState.READY.value}},
        )

        nodes = await self.db.nodes.find(
            {"wallet_address": {"$in": coalition["participants"]}}
        ).to_list(length=len(coalition["participants"]))

        async def _connect_one(node: dict) -> str:
            url = f"{node['worker_url'].rstrip('/')}/coalition/connect-pool"
            r = await self.http.post(
                url, json={"pool_address": pool_address}, timeout=30.0,
            )
            r.raise_for_status()
            return r.json().get("tx_hash", "")

        results = await asyncio.gather(
            *(_connect_one(n) for n in nodes), return_exceptions=True,
        )
        for node, res in zip(nodes, results):
            if isinstance(res, Exception):
                logger.error(
                    "worker connect-pool failed node=%s err=%s",
                    node.get("node_id"), res,
                )
            else:
                logger.info(
                    "worker connect-pool ok node=%s tx=%s",
                    node.get("node_id"), res,
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

    async def on_payment_received(
        self,
        *,
        pool_id: str,
        payer: str,
        amount_usdc_micro: int,
        amount_usdcx_wei: int,
        estimated_duration_s: float,
        inference_request_id: str,
    ) -> None:
        """Persist a Payment and trigger the stream-start workflow.

        If the requested rate would round below the floor, scale BOTH the rate
        and the budget so the on-chain stream stays consistent (rate * duration
        ~= budget). Without this the floored rate would drain the budget early.
        """
        duration = max(1, int(estimated_duration_s))
        rate_floor = 10**9
        raw_rate = amount_usdcx_wei // duration
        if raw_rate < rate_floor:
            flow_rate = rate_floor
            amount_usdcx_wei = flow_rate * duration
        else:
            flow_rate = raw_rate

        pp = await self.db.payment_pools.find_one({"pool_id": pool_id})
        if not pp:
            raise RuntimeError(f"no payment pool for pool_id={pool_id}")

        await self.db.payments.insert_one(
            {
                "_id": inference_request_id,
                "pool_id": pool_id,
                "payer": payer,
                "amount_usdc_micro": amount_usdc_micro,
                "amount_usdcx_wei": str(amount_usdcx_wei),
                "flow_rate_wei_per_sec": str(flow_rate),
                "estimated_duration_s": estimated_duration_s,
                "inference_request_id": inference_request_id,
                "state": PaymentState.VERIFIED.value,
                "created_at": datetime.now(timezone.utc),
            }
        )

        # TODO(KH-issue): KH 0G writes hang. Submitting GDA distributeFlow
        # directly. Restore kh.execute_workflow(...) once KH ships the fix.
        #
        # await self.kh.execute_workflow(
        #     self.settings.kh_workflow_stream_start,
        #     inputs=WorkflowInputs.stream_start(
        #         session_id=inference_request_id,
        #         super_token=self.settings.usdcx_address,
        #         pool_address=pp["superfluid_pool_address"],
        #         sender=self.settings.orchestrator_wallet_address,
        #         flow_rate_wei_per_sec=str(flow_rate),
        #         callback_url=self.settings.public_url.rstrip("/")
        #         + "/webhooks/keeperhub",
        #     ),
        # )
        if self.onchain is None:
            raise RuntimeError("onchain submitter required while KH 0G writes are broken")
        stream_res = await self.onchain.distribute_flow(
            super_token=self.settings.usdcx_address,
            sender=self.onchain.address,
            pool=pp["superfluid_pool_address"],
            flow_rate_wei_per_sec=flow_rate,
        )
        logger.info(
            "stream_start submitted directly session_id=%s tx=%s",
            inference_request_id, stream_res["tx_hash"],
        )
        asyncio.create_task(self.on_stream_started({
            "session_id": inference_request_id,
            "tx_hash": stream_res["tx_hash"],
            "flow_rate": str(flow_rate),
        }))

    async def on_stream_started(self, payload: dict) -> None:
        await self.db.payments.update_one(
            {"_id": payload["session_id"]},
            {
                "$set": {
                    "state": PaymentState.STREAMING.value,
                    "stream_open_tx": payload.get("tx_hash"),
                }
            },
        )

    async def on_inference_complete(
        self,
        *,
        pool_id: str,
        inference_request_id: str,
    ) -> None:
        pp = await self.db.payment_pools.find_one({"pool_id": pool_id})
        # TODO(KH-issue): KH 0G writes hang. Submitting GDA distributeFlow
        # rate=0 directly. Restore kh.execute_workflow(...) once KH ships fix.
        #
        # await self.kh.execute_workflow(
        #     self.settings.kh_workflow_stream_stop,
        #     inputs=WorkflowInputs.stream_stop(
        #         session_id=inference_request_id,
        #         super_token=self.settings.usdcx_address,
        #         pool_address=pp["superfluid_pool_address"],
        #         sender=self.settings.orchestrator_wallet_address,
        #         callback_url=self.settings.public_url.rstrip("/")
        #         + "/webhooks/keeperhub",
        #     ),
        # )
        if self.onchain is None:
            raise RuntimeError("onchain submitter required while KH 0G writes are broken")
        stop_res = await self.onchain.distribute_flow(
            super_token=self.settings.usdcx_address,
            sender=self.onchain.address,
            pool=pp["superfluid_pool_address"],
            flow_rate_wei_per_sec=0,
        )
        logger.info(
            "stream_stop submitted directly session_id=%s tx=%s",
            inference_request_id, stop_res["tx_hash"],
        )
        asyncio.create_task(self.on_stream_stopped({
            "session_id": inference_request_id,
            "tx_hash": stop_res["tx_hash"],
        }))

    async def on_stream_stopped(self, payload: dict) -> None:
        await self.db.payments.update_one(
            {"_id": payload["session_id"]},
            {
                "$set": {
                    "state": PaymentState.STOPPED.value,
                    "stream_close_tx": payload.get("tx_hash"),
                }
            },
        )

    async def mark_settled(
        self,
        *,
        inference_request_id: str,
        settle_tx: str | None,
    ) -> None:
        state = PaymentState.SETTLED if settle_tx else PaymentState.ORPHANED
        await self.db.payments.update_one(
            {"_id": inference_request_id},
            {
                "$set": {
                    "state": state.value,
                    "settle_tx": settle_tx,
                }
            },
        )
