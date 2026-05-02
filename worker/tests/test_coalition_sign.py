from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


def make_app():
    from worker.coalition_sign import router
    app = FastAPI()
    app.include_router(router)
    return app


def test_sign_onchain_submits_tx(_worker_env):
    app = make_app()
    client = TestClient(app)
    with patch(
        "worker.coalition_sign._submit_sign_onchain",
        new=AsyncMock(return_value=("0xdead", "0x" + "aa" * 20)),
    ):
        r = client.post(
            "/coalition/sign-onchain",
            json={
                "coalition_onchain_id": 7,
                "coalition_address": "0x" + "11" * 20,
                "stake_token": "0x" + "22" * 20,
                "stake_amount": "1000000",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["tx_hash"] == "0xdead"
        assert body["signer"] == "0x" + "aa" * 20


def test_sign_onchain_rejects_bad_coalition_address(_worker_env):
    app = make_app()
    client = TestClient(app)
    r = client.post(
        "/coalition/sign-onchain",
        json={
            "coalition_onchain_id": 1,
            "coalition_address": "not-hex",
            "stake_token": "0x" + "22" * 20,
            "stake_amount": "1",
        },
    )
    assert r.status_code == 400


def test_sign_onchain_rejects_short_coalition_address(_worker_env):
    app = make_app()
    client = TestClient(app)
    r = client.post(
        "/coalition/sign-onchain",
        json={
            "coalition_onchain_id": 1,
            "coalition_address": "0x1234",
            "stake_token": "0x" + "22" * 20,
            "stake_amount": "1",
        },
    )
    assert r.status_code == 400


def test_sign_onchain_rejects_bad_stake_token(_worker_env):
    app = make_app()
    client = TestClient(app)
    r = client.post(
        "/coalition/sign-onchain",
        json={
            "coalition_onchain_id": 1,
            "coalition_address": "0x" + "11" * 20,
            "stake_token": "nope",
            "stake_amount": "1",
        },
    )
    assert r.status_code == 400


def test_connect_pool_submits_tx(_worker_env):
    app = make_app()
    client = TestClient(app)
    with patch(
        "worker.coalition_sign._submit_connect_pool",
        new=AsyncMock(return_value="0xfeed"),
    ):
        r = client.post(
            "/coalition/connect-pool",
            json={"pool_address": "0x" + "11" * 20},
        )
        assert r.status_code == 200
        assert r.json()["tx_hash"] == "0xfeed"


def test_connect_pool_rejects_bad_address(_worker_env):
    app = make_app()
    client = TestClient(app)
    r = client.post(
        "/coalition/connect-pool",
        json={"pool_address": "not-hex"},
    )
    assert r.status_code == 400
