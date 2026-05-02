from facilitator.settings import Settings


def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("SEPOLIA_RPC_URL", "https://example/rpc")
    monkeypatch.setenv("RELAYER_PRIVATE_KEY", "0x" + "11" * 32)
    monkeypatch.setenv("USDC_ADDRESS", "0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189")
    s = Settings()
    assert s.sepolia_rpc_url == "https://example/rpc"
    assert s.relayer_private_key.startswith("0x")
    assert s.chain_id == 16602
    assert s.usdc_decimals == 6


def test_settings_rejects_missing_relayer_key(monkeypatch):
    monkeypatch.delenv("RELAYER_PRIVATE_KEY", raising=False)
    monkeypatch.setenv("SEPOLIA_RPC_URL", "https://example/rpc")
    monkeypatch.setenv("USDC_ADDRESS", "0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189")
    import pytest
    with pytest.raises(Exception):
        Settings()
