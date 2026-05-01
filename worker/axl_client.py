from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


class AXLClient:
    def __init__(
        self,
        api_url: str = "http://localhost:9002",
        request_timeout: float = 30.0,
    ) -> None:
        self.api_url = api_url.rstrip("/")
        self.request_timeout = request_timeout
        self._sync = httpx.Client(timeout=request_timeout)
        self._async: Optional[httpx.AsyncClient] = None

        self._our_public_key: Optional[str] = None
        self._our_ipv6: Optional[str] = None

    def _fetch_topology(self) -> dict:
        r = self._sync.get(f"{self.api_url}/topology")
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, dict):
            raise RuntimeError(f"unexpected /topology response type: {type(data)}")
        self._our_public_key = data.get("our_public_key")
        self._our_ipv6 = data.get("our_ipv6")
        return data

    def our_peer_id(self) -> str:
        if self._our_public_key is None:
            self._fetch_topology()
        if not self._our_public_key:
            raise RuntimeError("AXL /topology returned no our_public_key")
        return self._our_public_key

    def our_ipv6(self) -> str:
        if self._our_ipv6 is None:
            self._fetch_topology()
        if not self._our_ipv6:
            raise RuntimeError("AXL /topology returned no our_ipv6")
        return self._our_ipv6

    def wait_until_ready(self, timeout: float = 30.0) -> None:
        deadline = time.monotonic() + timeout
        last_err: Optional[Exception] = None
        while time.monotonic() < deadline:
            try:
                self._fetch_topology()
                logger.info(
                    "AXL ready: peer_id=%s ipv6=%s",
                    self._our_public_key,
                    self._our_ipv6,
                )
                return
            except Exception as e:
                last_err = e
                time.sleep(0.5)
        raise TimeoutError(f"AXL daemon not ready after {timeout}s; last error: {last_err!r}")

    def send(self, payload: bytes, dest_peer_id: str) -> None:
        if not dest_peer_id:
            raise ValueError("dest_peer_id is required")

        body = bytes(payload)
        url = f"{self.api_url}/send"
        headers = {
            "X-Destination-Peer-Id": dest_peer_id,
            "Content-Type": "application/octet-stream",
        }

        last_err: Optional[Exception] = None
        for attempt in range(3):
            try:
                r = self._sync.post(url, content=body, headers=headers)
                if 200 <= r.status_code < 300:
                    logger.debug(
                        "AXL send ok dest=%s bytes=%d attempt=%d",
                        dest_peer_id,
                        len(body),
                        attempt,
                    )
                    return
                raise RuntimeError(f"AXL /send returned HTTP {r.status_code}: {r.text[:200]}")
            except Exception as e:
                last_err = e
                logger.warning(
                    "AXL send failed (attempt %d/3) dest=%s err=%r",
                    attempt + 1,
                    dest_peer_id,
                    e,
                )
                if attempt < 2:
                    time.sleep(0.5)
        raise RuntimeError(f"AXL send failed after 3 attempts: {last_err!r}")

    async def _ensure_async(self) -> httpx.AsyncClient:
        if self._async is None:
            self._async = httpx.AsyncClient(timeout=self.request_timeout)
        return self._async

    async def recv(
        self,
        timeout: float = 30.0,
        poll_interval: float = 0.05,
    ) -> Optional[Tuple[bytes, str]]:
        client = await self._ensure_async()
        url = f"{self.api_url}/recv"
        deadline = asyncio.get_event_loop().time() + timeout
        backoff = poll_interval
        max_backoff = 0.5

        while True:
            try:
                r = await client.get(url)
            except Exception as e:
                logger.warning("AXL recv HTTP error: %r", e)
                await asyncio.sleep(backoff)
                backoff = min(max_backoff, backoff * 2)
                if asyncio.get_event_loop().time() >= deadline:
                    return None
                continue

            if 200 <= r.status_code < 300:
                body = r.content or b""
                if body:
                    from_peer = r.headers.get("X-From-Peer-Id", "")
                    logger.debug("AXL recv bytes=%d from=%s", len(body), from_peer)
                    return body, from_peer
            else:
                logger.warning("AXL /recv non-2xx HTTP %d: %s", r.status_code, r.text[:200])

            if asyncio.get_event_loop().time() >= deadline:
                return None

            await asyncio.sleep(backoff)
            backoff = min(max_backoff, backoff * 1.5)

    async def aclose(self) -> None:
        if self._async is not None:
            await self._async.aclose()
            self._async = None

    def close(self) -> None:
        self._sync.close()


__all__ = ["AXLClient"]
