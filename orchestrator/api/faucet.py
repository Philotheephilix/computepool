"""Testnet USDC faucet — auto-mints the EIP-3009 mock USDC on 0G Galileo.

Why this exists:
    The frontend signs an x402 EIP-3009 ``transferWithAuthorization`` voucher
    over USDC at ``0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189`` (a mock the
    deployer wallet owns). For the demo to work end-to-end, the user's
    connected wallet needs USDC balance ≥ ``maxAmountRequired`` *before* the
    voucher gets settled by the facilitator. We don't want demo users to
    chase a faucet bot in Discord — we want the orchestrator to top them up
    automatically when it returns a 402.

    The mock exposes ``mint(address,uint256)`` (selector ``0x40c10f19``)
    gated by OpenZeppelin Ownable — only the deployer
    (``0x5a09e3eC3EFDD91205Cbb097142a4f4dCEFc7f02``) can call it. We sign
    the mint tx with that key (read from ``FAUCET_PRIVATE_KEY`` or, as
    fallback, ``ORCHESTRATOR_PRIVATE_KEY``) and broadcast directly via
    web3.py — same pattern as ``orchestrator/onchain.py``.

    The endpoint is intentionally unauthenticated (testnet only). It caps
    the per-call mint amount and best-effort dedupes recent mints per
    wallet so a refresh-spammer can't drain gas.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from web3 import AsyncWeb3, AsyncHTTPProvider
from eth_account import Account

from ..settings import get_settings


logger = logging.getLogger("discom.faucet")


# Same minimum priority tip floor as orchestrator/onchain.py — 0G's mempool
# rejects tx with `gas tip cap` below 2 Gwei.
DEFAULT_PRIORITY_FEE_WEI = 2_500_000_000  # 2.5 Gwei

# USDC mock has 6 decimals (confirmed via eth_call decimals() against the
# deployed contract). 1 USDC = 1_000_000 base units.
USDC_DECIMALS = 6

# Cap per-call mint amount. The default request is 100 USDC (1e8 base units);
# we let callers go up to 1000 USDC.
DEFAULT_MINT_USDC = 100
MAX_MINT_USDC = 1000

# Per-wallet cooldown — drop duplicate mint requests inside this window.
MINT_DEDUPE_WINDOW_S = 30.0

# Minimum USDC balance below which we consider a wallet "needs topping up"
# even when the caller passes ``amount`` larger than the existing balance.
# Used by the optional balance-check shortcut.
TOP_UP_THRESHOLD_USDC = 50

ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
PRIVATE_KEY_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")


# Minimal ABI — just what we call.
USDC_ABI = json.loads("""[
  {"name":"mint","type":"function","stateMutability":"nonpayable",
   "inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],
   "outputs":[]},
  {"name":"balanceOf","type":"function","stateMutability":"view",
   "inputs":[{"name":"account","type":"address"}],
   "outputs":[{"type":"uint256"}]},
  {"name":"decimals","type":"function","stateMutability":"view",
   "inputs":[],
   "outputs":[{"type":"uint8"}]},
  {"name":"owner","type":"function","stateMutability":"view",
   "inputs":[],
   "outputs":[{"type":"address"}]}
]""")


class MintRequest(BaseModel):
    wallet: str = Field(..., description="0x-prefixed 40-hex EVM address to mint USDC to")
    amount: Optional[int] = Field(
        default=None,
        ge=1,
        description=f"USDC (whole units, not micro). Defaults to {DEFAULT_MINT_USDC}, max {MAX_MINT_USDC}.",
    )


class _RecentMintCache:
    """Best-effort in-process dedupe so a UI refresh storm doesn't spam mints."""

    def __init__(self, window_s: float = MINT_DEDUPE_WINDOW_S):
        self._window = window_s
        # wallet (lower) -> (last_ts, last_tx_hash, last_amount_micro)
        self._last: dict[str, tuple[float, str, int]] = {}
        self._lock = asyncio.Lock()

    async def get_recent(self, wallet: str) -> Optional[tuple[str, int]]:
        async with self._lock:
            entry = self._last.get(wallet.lower())
            if not entry:
                return None
            ts, tx, amt = entry
            if time.monotonic() - ts > self._window:
                return None
            return (tx, amt)

    async def set(self, wallet: str, tx: str, amount_micro: int) -> None:
        async with self._lock:
            self._last[wallet.lower()] = (time.monotonic(), tx, amount_micro)


def _resolve_faucet_key() -> Optional[str]:
    """Return the private key to sign mint txs with, or None if no usable key.

    Checks env-derived settings first (``FAUCET_PRIVATE_KEY`` if present), then
    falls back to ``ORCHESTRATOR_PRIVATE_KEY``. Returns None for the dummy
    sentinel ``0x0000…01`` that the live deploy uses as a placeholder so
    callers can surface a clean error instead of broadcasting a tx that will
    revert.
    """
    s = get_settings()
    candidate = getattr(s, "faucet_private_key", None) or s.orchestrator_private_key
    if not candidate:
        return None
    if not PRIVATE_KEY_RE.match(candidate):
        return None
    # Reject the obvious dummy keys used in dev placeholders.
    stripped = candidate[2:].lower()
    if stripped == "0" * 63 + "1" or stripped == "0" * 64:
        return None
    return candidate


def _to_micro(amount_usdc: int) -> int:
    return int(amount_usdc) * (10 ** USDC_DECIMALS)


def build_router() -> APIRouter:
    router = APIRouter()
    cache = _RecentMintCache()

    async def _make_w3() -> AsyncWeb3:
        s = get_settings()
        return AsyncWeb3(AsyncHTTPProvider(s.zero_g_chain_rpc))

    @router.get("/faucet/usdc-balance")
    async def usdc_balance(wallet: str = Query(...)):
        if not ADDRESS_RE.match(wallet):
            return JSONResponse(status_code=200, content={
                "ok": False,
                "error": "wallet must be a 0x-prefixed 40-hex EVM address",
            })
        s = get_settings()
        try:
            w3 = await _make_w3()
            usdc = w3.eth.contract(
                address=AsyncWeb3.to_checksum_address(s.usdc_address),
                abi=USDC_ABI,
            )
            raw = await usdc.functions.balanceOf(
                AsyncWeb3.to_checksum_address(wallet)
            ).call()
            return {
                "ok": True,
                "wallet": AsyncWeb3.to_checksum_address(wallet),
                "balance_micro": str(int(raw)),
                "balance_usdc": int(raw) / (10 ** USDC_DECIMALS),
                "asset": s.usdc_address,
                "chain_id": s.zero_g_chain_id,
            }
        except Exception as e:
            logger.exception("usdc-balance failed wallet=%s", wallet)
            return JSONResponse(status_code=200, content={
                "ok": False,
                "error": f"balance lookup failed: {e!r}",
            })

    @router.post("/faucet/usdc-mint")
    async def usdc_mint(req: MintRequest):
        wallet = req.wallet
        if not ADDRESS_RE.match(wallet):
            return JSONResponse(status_code=200, content={
                "ok": False,
                "error": "wallet must be a 0x-prefixed 40-hex EVM address",
            })

        amount_usdc = req.amount if req.amount is not None else DEFAULT_MINT_USDC
        if amount_usdc < 1 or amount_usdc > MAX_MINT_USDC:
            return JSONResponse(status_code=200, content={
                "ok": False,
                "error": f"amount must be between 1 and {MAX_MINT_USDC} USDC",
            })

        # Dedupe near-duplicate calls — return the previous tx hash.
        recent = await cache.get_recent(wallet)
        if recent is not None:
            tx, amt = recent
            return {
                "ok": True,
                "wallet": AsyncWeb3.to_checksum_address(wallet),
                "tx_hash": tx,
                "amount_minted_usdc": amt // (10 ** USDC_DECIMALS),
                "amount_minted_micro": str(amt),
                "deduped": True,
            }

        s = get_settings()
        key = _resolve_faucet_key()
        if key is None:
            return JSONResponse(status_code=200, content={
                "ok": False,
                "error": (
                    "faucet not configured: set FAUCET_PRIVATE_KEY (or a real "
                    "ORCHESTRATOR_PRIVATE_KEY whose wallet owns the mock USDC)"
                ),
            })

        try:
            w3 = await _make_w3()
            account = Account.from_key(key)
            usdc = w3.eth.contract(
                address=AsyncWeb3.to_checksum_address(s.usdc_address),
                abi=USDC_ABI,
            )
            amount_micro = _to_micro(amount_usdc)

            nonce = await w3.eth.get_transaction_count(account.address)
            block = await w3.eth.get_block("latest")
            base = block["baseFeePerGas"]
            fn = usdc.functions.mint(
                AsyncWeb3.to_checksum_address(wallet),
                amount_micro,
            )
            tx = await fn.build_transaction({
                "chainId": s.zero_g_chain_id,
                "from": account.address,
                "nonce": nonce,
                "gas": 200_000,
                "maxFeePerGas": base + DEFAULT_PRIORITY_FEE_WEI + 1_000_000_000,
                "maxPriorityFeePerGas": DEFAULT_PRIORITY_FEE_WEI,
                "type": 2,
            })
            signed = account.sign_transaction(tx)
            h = await w3.eth.send_raw_transaction(signed.raw_transaction)
            tx_hash = "0x" + h.hex().removeprefix("0x")

            try:
                receipt = await asyncio.wait_for(
                    w3.eth.wait_for_transaction_receipt(h, timeout=60), timeout=70
                )
                status = int(receipt.get("status", 0))
                if status != 1:
                    return JSONResponse(status_code=200, content={
                        "ok": False,
                        "error": f"mint tx reverted: {tx_hash}",
                        "tx_hash": tx_hash,
                    })
            except asyncio.TimeoutError:
                # Tx broadcast but receipt not yet observed — return what we
                # have so the frontend can proceed; the facilitator will see
                # the balance once the mint lands (typically <10s on 0G).
                logger.warning("mint tx broadcast but receipt timed out tx=%s", tx_hash)

            await cache.set(wallet, tx_hash, amount_micro)

            return {
                "ok": True,
                "wallet": AsyncWeb3.to_checksum_address(wallet),
                "tx_hash": tx_hash,
                "amount_minted_usdc": amount_usdc,
                "amount_minted_micro": str(amount_micro),
                "asset": s.usdc_address,
                "chain_id": s.zero_g_chain_id,
                "explorer": f"https://chainscan-galileo.0g.ai/tx/{tx_hash}",
            }

        except Exception as e:
            logger.exception("usdc-mint failed wallet=%s amount=%s", wallet, amount_usdc)
            return JSONResponse(status_code=200, content={
                "ok": False,
                "error": f"mint failed: {e!r}",
            })

    return router
