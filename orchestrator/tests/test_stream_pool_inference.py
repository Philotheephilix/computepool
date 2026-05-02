import pytest

from orchestrator.api.infer import stream_pool_inference, run_pool_inference


@pytest.mark.asyncio
async def test_stream_pool_inference_yields_tokens_then_done(mock_loaded_pool):
    """The helper must yield {token: str} per token and end with a {done: True} record."""
    seen_tokens = []
    final = None
    async for ev in stream_pool_inference(
        pool_name=mock_loaded_pool["name"],
        prompt="hi",
        max_tokens=4,
        _pool=mock_loaded_pool["pool"],
        _run_stream=mock_loaded_pool["run_stream"],
    ):
        if "token" in ev:
            seen_tokens.append(ev["token"])
        elif ev.get("done"):
            final = ev
    assert seen_tokens, "expected at least one token"
    assert final is not None and final["done"] is True
    assert final["tokens_in"] >= 1 and final["tokens_out"] >= 1


@pytest.mark.asyncio
async def test_run_pool_inference_drains_helper(mock_loaded_pool):
    out = await run_pool_inference(
        pool_name=mock_loaded_pool["name"],
        prompt="hi",
        max_tokens=4,
        _pool=mock_loaded_pool["pool"],
        _run_stream=mock_loaded_pool["run_stream"],
    )
    assert "output" in out and isinstance(out["output"], str)
    assert out["tokens_in"] >= 1 and out["tokens_out"] >= 1
    assert out["hit_max"] is (out["tokens_out"] >= 4)


@pytest.mark.asyncio
async def test_stream_pool_inference_token_content(mock_loaded_pool):
    """Tokens yielded should be non-empty strings from the fake stream."""
    tokens = []
    async for ev in stream_pool_inference(
        pool_name=mock_loaded_pool["name"],
        prompt="hello world",
        max_tokens=3,
        _pool=mock_loaded_pool["pool"],
        _run_stream=mock_loaded_pool["run_stream"],
    ):
        if "token" in ev:
            tokens.append(ev["token"])
    assert tokens == ["tok0", "tok1", "tok2"]


@pytest.mark.asyncio
async def test_run_pool_inference_output_is_concatenated(mock_loaded_pool):
    """run_pool_inference output must be the concatenation of all tokens."""
    out = await run_pool_inference(
        pool_name=mock_loaded_pool["name"],
        prompt="hi",
        max_tokens=3,
        _pool=mock_loaded_pool["pool"],
        _run_stream=mock_loaded_pool["run_stream"],
    )
    assert out["output"] == "tok0tok1tok2"
    assert out["tokens_out"] == 3
    assert out["hit_max"] is True  # 3 >= 3


@pytest.mark.asyncio
async def test_run_pool_inference_hit_max_false_when_under_limit(mock_loaded_pool):
    """hit_max is False when fewer tokens were generated than max_tokens."""
    # mock produces min(max_tokens, 3) tokens; with max_tokens=10 it produces 3
    out = await run_pool_inference(
        pool_name=mock_loaded_pool["name"],
        prompt="hi",
        max_tokens=10,
        _pool=mock_loaded_pool["pool"],
        _run_stream=mock_loaded_pool["run_stream"],
    )
    assert out["tokens_out"] == 3
    assert out["hit_max"] is False  # 3 < 10
