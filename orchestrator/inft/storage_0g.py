import httpx

# NOTE: verify /file/segment and /file?root= paths against indexer docs at /api
# before production use — these match the 0G testnet-turbo indexer HTTP gateway shape.


def parse_uri(uri: str) -> str:
    if not uri.startswith("0g://"):
        raise ValueError(f"not a 0G storage URI: {uri}")
    root = uri.removeprefix("0g://")
    return "0x" + root


async def upload_blob(data: bytes, *, indexer_url: str, timeout: float = 30.0) -> str:
    """POST raw bytes to the indexer's /file/segment endpoint; return 0g://<root_hex>."""
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(
            f"{indexer_url}/file/segment",
            content=data,
            headers={"Content-Type": "application/octet-stream"},
        )
        r.raise_for_status()
        root = r.json()["root"]
    return "0g://" + root.removeprefix("0x")


async def download_blob(uri: str, *, indexer_url: str, timeout: float = 30.0) -> bytes:
    root = parse_uri(uri)
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.get(f"{indexer_url}/file", params={"root": root})
        r.raise_for_status()
    return r.content
