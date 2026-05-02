from orchestrator.settings import get_settings, Settings


def test_settings_loads(_orchestrator_env):  # fixture from conftest
    s = get_settings()
    assert isinstance(s, Settings)
    assert s.chain_id == 16602
    assert s.keeperhub_base_url == "https://api.keeperhub.com"
    assert s.usdcx_address.startswith("0x")


def test_settings_singleton(_orchestrator_env):
    a = get_settings()
    b = get_settings()
    assert a is b
