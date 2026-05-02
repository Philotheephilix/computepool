import pytest
from unittest.mock import AsyncMock

from orchestrator.economics import EconomicsService


class _FakeColl:
    def __init__(self):
        self.docs = []

    async def insert_one(self, d):
        self.docs.append(d)

    async def find_one(self, q):
        for d in self.docs:
            if all(d.get(k) == v for k, v in q.items()):
                return d
        return None


class _FakeDB:
    def __init__(self):
        self.coalitions = _FakeColl()


@pytest.mark.asyncio
async def test_on_pool_initialize_persists_and_triggers_workflow(_orchestrator_env):
    from orchestrator.settings import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    db = _FakeDB()
    kh = AsyncMock()
    kh.execute_workflow = AsyncMock(return_value={"executionId": "exec_1"})
    svc = EconomicsService(
        db=db, kh=kh, chain=None, settings=settings, http=AsyncMock()
    )

    pool = {
        "_id": "p1",
        "model": "Qwen/Qwen2.5-3B-Instruct",
        "assignments": [
            {"node_id": "a", "role": "entry", "layers": [0, 17]},
            {"node_id": "b", "role": "exit", "layers": [18, 35]},
        ],
    }
    cid = await svc.on_pool_initialize(
        pool=pool,
        participants=["0xa", "0xb"],
        stake_amount_wei=1_000_000,
        deadline_unix=2_000_000_000,
    )
    assert cid
    saved = db.coalitions.docs[0]
    assert saved["pool_id"] == "p1"
    assert saved["participants"] == ["0xa", "0xb"]
    kh.execute_workflow.assert_awaited_once()
    args, kwargs = kh.execute_workflow.call_args
    assert args[0] == settings.kh_workflow_coalition_form
    assert kwargs["inputs"]["session_id"] == cid
