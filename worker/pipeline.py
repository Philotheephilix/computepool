from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, AsyncIterator, Dict

import torch
from transformers.cache_utils import DynamicCache

from .axl_client import AXLClient
from .framing import (
    pack_control,
    pack_tensor,
    pack_token,
    unpack,
    unpack_control,
    unpack_tensor,
    unpack_token,
)
from .model import SplitModel, sample_next_token

logger = logging.getLogger(__name__)


class EntryDispatcher:
    def __init__(self) -> None:
        self._pending: Dict[str, asyncio.Queue] = {}
        self._lock = asyncio.Lock()

    async def register(self, request_id: str) -> asyncio.Queue:
        async with self._lock:
            q: asyncio.Queue = asyncio.Queue()
            self._pending[request_id] = q
            return q

    async def unregister(self, request_id: str) -> None:
        async with self._lock:
            self._pending.pop(request_id, None)

    async def dispatch(self, request_id: str, token_id: int) -> None:
        async with self._lock:
            q = self._pending.get(request_id)
        if q is None:
            logger.warning(
                "entry: dropping token for unknown request_id=%s token=%d",
                request_id,
                token_id,
            )
            return
        await q.put(token_id)


def _peer_match(from_peer: str, expected: str) -> bool:
    if not expected or not from_peer:
        return False
    if from_peer == expected:
        return True
    # AXL's X-From-Peer-Id is a Yggdrasil tree-routing prefix padded with
    # 7fff..., not the full pubkey. 16 hex chars (64 bits) of leading match
    # is collision-resistant for any practical deployment.
    return len(from_peer) >= 16 and from_peer[:16] == expected[:16]


async def entry_recv_loop(
    axl: AXLClient, dispatcher: EntryDispatcher, expected_peer_id: str
) -> None:
    logger.info("entry recv loop started (expecting peer=%s)", expected_peer_id[:12])
    try:
        while True:
            res = await axl.recv(timeout=60.0, poll_interval=0.05)
            if res is None:
                continue
            blob, from_peer = res
            if not _peer_match(from_peer, expected_peer_id):
                logger.warning(
                    "entry: dropping AXL frame from unexpected peer=%s (expected %s)",
                    from_peer[:16], expected_peer_id[:16],
                )
                continue
            try:
                header, _ = unpack(blob)
            except Exception as e:
                logger.warning("entry: malformed AXL message: %r", e)
                continue

            kind = header.get("kind")
            req_id = header.get("request_id", "")
            seq = header.get("seq", -1)

            if kind == "token":
                try:
                    _h, token_id = unpack_token(blob)
                except Exception as e:
                    logger.warning("entry: bad token frame: %r", e)
                    continue
                logger.info(
                    "entry: recv token req=%s seq=%s token=%d bytes=%d",
                    req_id, seq, token_id, len(blob),
                )
                await dispatcher.dispatch(req_id, token_id)
            elif kind == "control":
                logger.info("entry: recv control req=%s seq=%s (ignored)", req_id, seq)
            else:
                logger.warning("entry: unexpected kind=%s req=%s", kind, req_id)
    except asyncio.CancelledError:
        logger.info("entry recv loop cancelled")
        raise
    except Exception:
        logger.exception("entry recv loop crashed")
        raise


def _hidden_msg(hidden: torch.Tensor, request_id: str, seq: int, temperature: float) -> bytes:
    return pack_tensor(
        hidden,
        {
            "request_id": request_id,
            "kind": "hidden",
            "seq": seq,
            "temperature": float(temperature),
        },
    )


async def entry_generate_iter(
    model: SplitModel,
    axl: AXLClient,
    exit_peer_id: str,
    dispatcher: EntryDispatcher,
    prompt: str,
    max_tokens: int,
    temperature: float,
    request_id: str,
    recv_timeout: float = 120.0,
) -> AsyncIterator[Dict[str, Any]]:
    """Token-by-token generator. Yields one ``{"event":"token", ...}`` per
    token as it arrives from the exit, then a single ``{"event":"done", ...}``
    with the full text + summary timings."""
    if model.role != "entry":
        raise RuntimeError("entry_generate requires entry-role model")
    if not model.loaded:
        raise RuntimeError("entry_generate requires model.load() first")
    if not exit_peer_id:
        raise ValueError("exit_peer_id is required")

    tokenizer = model.tokenizer
    if tokenizer is None:
        raise RuntimeError("tokenizer not available")

    eos_id = tokenizer.eos_token_id
    t_tok_start = time.monotonic()
    enc = tokenizer(prompt, return_tensors="pt", add_special_tokens=True)
    input_ids: torch.Tensor = enc["input_ids"]
    prompt_len = int(input_ids.shape[1])
    t_tokenize = time.monotonic() - t_tok_start

    timings: Dict[str, Any] = {
        "tokenize_s": t_tokenize,
        "prefill_compute_s": 0.0,
        "prefill_send_s": 0.0,
        "prefill_first_token_wait_s": 0.0,
        "decode_compute_s": [],
        "decode_send_s": [],
        "decode_wait_s": [],
    }
    logger.info(
        "entry: starting generation req=%s prompt_len=%d max_tokens=%d temp=%s",
        request_id, prompt_len, max_tokens, temperature,
    )

    queue = await dispatcher.register(request_id)
    generated_ids: list[int] = []
    emitted_text = ""
    start = time.monotonic()
    past_kv = DynamicCache()
    seq_counter = 0

    try:
        t0 = time.monotonic()
        hidden, past_kv = await asyncio.to_thread(model.forward_entry, input_ids, past_kv)
        timings["prefill_compute_s"] = time.monotonic() - t0

        msg = _hidden_msg(hidden, request_id, seq_counter, temperature)
        t0 = time.monotonic()
        await asyncio.to_thread(axl.send, msg, exit_peer_id)
        timings["prefill_send_s"] = time.monotonic() - t0
        logger.info(
            "entry: send hidden req=%s seq=%d shape=%s bytes=%d",
            request_id, seq_counter, list(hidden.shape), len(msg),
        )

        for step in range(max_tokens):
            t0 = time.monotonic()
            try:
                token_id = await asyncio.wait_for(queue.get(), timeout=recv_timeout)
            except asyncio.TimeoutError:
                raise RuntimeError(
                    f"entry: timed out waiting for token from exit (req={request_id}, seq={seq_counter})"
                )
            wait_dt = time.monotonic() - t0
            if step == 0:
                timings["prefill_first_token_wait_s"] = wait_dt
            else:
                timings["decode_wait_s"].append(wait_dt)

            generated_ids.append(int(token_id))

            # Incremental decode: BPE tokens may be sub-word, so decode the
            # full sequence each step and emit the new suffix. Cheap relative
            # to the model forward pass.
            full_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
            delta = full_text[len(emitted_text):]
            emitted_text = full_text
            yield {
                "event": "token",
                "request_id": request_id,
                "seq": step,
                "token_id": int(token_id),
                "delta": delta,
            }

            if (eos_id is not None and token_id == eos_id) or step == max_tokens - 1:
                break

            seq_counter += 1
            new_id = torch.tensor([[token_id]], dtype=torch.long)
            t0 = time.monotonic()
            hidden, past_kv = await asyncio.to_thread(model.forward_entry, new_id, past_kv)
            timings["decode_compute_s"].append(time.monotonic() - t0)

            msg = _hidden_msg(hidden, request_id, seq_counter, temperature)
            t0 = time.monotonic()
            await asyncio.to_thread(axl.send, msg, exit_peer_id)
            timings["decode_send_s"].append(time.monotonic() - t0)
            logger.info(
                "entry: send hidden req=%s seq=%d shape=%s bytes=%d",
                request_id, seq_counter, list(hidden.shape), len(msg),
            )

        end_msg = pack_control({"type": "end"}, request_id, seq=seq_counter + 1)
        try:
            await asyncio.to_thread(axl.send, end_msg, exit_peer_id)
            logger.info("entry: send control end req=%s", request_id)
        except Exception:
            logger.exception("entry: failed to send control end (continuing)")

        elapsed = time.monotonic() - start
        n = len(generated_ids)

        avg = lambda xs: (sum(xs) / len(xs)) if xs else 0.0
        timings_summary = {
            "tokenize_s": timings["tokenize_s"],
            "prefill_compute_s": timings["prefill_compute_s"],
            "prefill_send_s": timings["prefill_send_s"],
            "prefill_first_token_wait_s": timings["prefill_first_token_wait_s"],
            "decode_compute_avg_s": avg(timings["decode_compute_s"]),
            "decode_send_avg_s": avg(timings["decode_send_s"]),
            "decode_wait_avg_s": avg(timings["decode_wait_s"]),
            "decode_steps": len(timings["decode_compute_s"]),
        }
        logger.info("entry: timings req=%s %s", request_id, timings_summary)
        yield {
            "event": "done",
            "request_id": request_id,
            "text": emitted_text,
            "tokens": n,
            "elapsed_s": elapsed,
            "tokens_per_sec": (n / elapsed) if elapsed > 0 else 0.0,
            "timings": timings_summary,
        }
    finally:
        await dispatcher.unregister(request_id)


async def entry_generate(
    model: SplitModel,
    axl: AXLClient,
    exit_peer_id: str,
    dispatcher: EntryDispatcher,
    prompt: str,
    max_tokens: int,
    temperature: float,
    request_id: str,
    recv_timeout: float = 120.0,
) -> dict:
    last: Dict[str, Any] | None = None
    async for ev in entry_generate_iter(
        model=model,
        axl=axl,
        exit_peer_id=exit_peer_id,
        dispatcher=dispatcher,
        prompt=prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        request_id=request_id,
        recv_timeout=recv_timeout,
    ):
        if ev["event"] == "done":
            last = ev
    if last is None:
        raise RuntimeError("entry_generate produced no done event")
    return {k: v for k, v in last.items() if k != "event"}


class ExitState:
    def __init__(self) -> None:
        self.caches: Dict[str, DynamicCache] = {}
        self.temperatures: Dict[str, float] = {}

    def drop(self, request_id: str) -> None:
        self.caches.pop(request_id, None)
        self.temperatures.pop(request_id, None)


def _exit_step_blocking(
    model: SplitModel,
    hidden: torch.Tensor,
    past_kv: DynamicCache,
    temperature: float,
) -> tuple[int, DynamicCache]:
    logits, past_kv = model.forward_exit(hidden, past_kv)
    last_logits = logits[0, -1, :]
    token_id = sample_next_token(last_logits, temperature=temperature)
    return token_id, past_kv


async def exit_loop(model: SplitModel, axl: AXLClient, expected_peer_id: str) -> None:
    if model.role != "exit":
        raise RuntimeError("exit_loop requires exit-role model")
    if not model.loaded:
        raise RuntimeError("exit_loop requires model.load() first")

    state = ExitState()
    logger.info("exit loop started (expecting peer=%s)", expected_peer_id[:12])
    try:
        while True:
            res = await axl.recv(timeout=60.0, poll_interval=0.05)
            if res is None:
                continue
            blob, from_peer = res
            if not _peer_match(from_peer, expected_peer_id):
                logger.warning(
                    "exit: dropping AXL frame from unexpected peer=%s (expected %s)",
                    from_peer[:16], expected_peer_id[:16],
                )
                continue
            try:
                header, _ = unpack(blob)
            except Exception as e:
                logger.warning("exit: malformed AXL message: %r", e)
                continue

            kind = header.get("kind")
            req_id = header.get("request_id", "")
            seq = header.get("seq", -1)

            if kind == "control":
                try:
                    _h, ctrl = unpack_control(blob)
                except Exception as e:
                    logger.warning("exit: bad control frame: %r", e)
                    continue
                ctype = ctrl.get("type")
                logger.info("exit: recv control req=%s seq=%s type=%s", req_id, seq, ctype)
                if ctype == "end":
                    state.drop(req_id)
                continue

            if kind != "hidden":
                logger.warning("exit: unexpected kind=%s req=%s", kind, req_id)
                continue

            t0 = time.monotonic()
            try:
                _h, hidden = unpack_tensor(blob, torch_module=torch)
            except Exception as e:
                logger.warning("exit: bad hidden frame: %r", e)
                continue
            t_unpack = time.monotonic() - t0

            if "temperature" in header:
                try:
                    state.temperatures[req_id] = float(header["temperature"])
                except Exception:
                    pass

            past_kv = state.caches.get(req_id)
            if past_kv is None:
                past_kv = DynamicCache()
                state.caches[req_id] = past_kv
            temperature = state.temperatures.get(req_id, 0.0)

            t0 = time.monotonic()
            try:
                token_id, past_kv = await asyncio.to_thread(
                    _exit_step_blocking, model, hidden, past_kv, temperature
                )
            except Exception:
                logger.exception("exit: forward step failed req=%s", req_id)
                continue
            t_forward = time.monotonic() - t0

            state.caches[req_id] = past_kv

            out = pack_token(token_id, request_id=req_id, seq=int(seq) + 1)
            t0 = time.monotonic()
            try:
                await asyncio.to_thread(axl.send, out, from_peer)
                t_send = time.monotonic() - t0
                logger.info(
                    "EXIT_TIMING req=%s seq=%s shape=%s unpack_s=%.4f forward_s=%.4f send_s=%.4f",
                    req_id, seq, list(hidden.shape), t_unpack, t_forward, t_send,
                )
                logger.info(
                    "exit: send token req=%s seq=%s token=%d bytes=%d",
                    req_id, int(seq) + 1, token_id, len(out),
                )
            except Exception:
                logger.exception("exit: failed to send token back req=%s peer=%s", req_id, from_peer)
    except asyncio.CancelledError:
        logger.info("exit loop cancelled; clearing %d cache(s)", len(state.caches))
        state.caches.clear()
        state.temperatures.clear()
        raise
    except Exception:
        logger.exception("exit loop crashed")
        raise


__all__ = [
    "EntryDispatcher",
    "entry_recv_loop",
    "entry_generate",
    "entry_generate_iter",
    "exit_loop",
]
