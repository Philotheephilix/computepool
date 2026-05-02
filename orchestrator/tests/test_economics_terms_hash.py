from orchestrator.economics import EconomicsService


def test_terms_hash_deterministic():
    cfg = {
        "model_name": "Qwen/Qwen2.5-3B-Instruct",
        "layer_split": [[0, 17], [18, 35]],
        "stake_amount_wei": "1000000",
        "deadline_unix": 1735689600,
    }
    a = EconomicsService.compute_terms_hash(cfg)
    b = EconomicsService.compute_terms_hash(cfg)
    assert a == b
    assert a.startswith("0x")
    assert len(a) == 66  # 0x + 32 bytes


def test_terms_hash_changes_on_input_change():
    base = {
        "model_name": "Qwen/Qwen2.5-3B-Instruct",
        "layer_split": [[0, 17], [18, 35]],
        "stake_amount_wei": "1000000",
        "deadline_unix": 1735689600,
    }
    other = dict(base, stake_amount_wei="2000000")
    assert EconomicsService.compute_terms_hash(base) != EconomicsService.compute_terms_hash(other)
