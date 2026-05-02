import pytest
from pytest_httpx import HTTPXMock

from orchestrator.inft.storage_0g import upload_blob, download_blob, parse_uri


@pytest.mark.asyncio
async def test_upload_returns_data_root(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://indexer.test/file/segment",
        method="POST",
        json={"root": "0xabcd"},
    )
    uri = await upload_blob(b"hello", indexer_url="https://indexer.test")
    assert uri == "0g://abcd"


@pytest.mark.asyncio
async def test_download_uses_root(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://indexer.test/file?root=0xabcd",
        method="GET",
        content=b"hello",
    )
    blob = await download_blob("0g://abcd", indexer_url="https://indexer.test")
    assert blob == b"hello"


def test_parse_uri():
    assert parse_uri("0g://deadbeef") == "0xdeadbeef"
    with pytest.raises(ValueError):
        parse_uri("ipfs://x")
