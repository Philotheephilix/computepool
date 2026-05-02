import os
import pytest
from eth_account import Account
from facilitator.eip3009 import build_typed_data


USDC_SEPOLIA = "0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189"


@pytest.fixture
def signer_account():
    return Account.from_key("0x" + "33" * 32)


@pytest.fixture
def signed_authorization(signer_account):
    auth = {
        "from": signer_account.address,
        "to": "0x000000000000000000000000000000000000bEEF",
        "value": "1000000",       # 1 USDC
        "validAfter": "0",
        "validBefore": "9999999999",
        "nonce": "0x" + "cd" * 32,
    }
    typed = build_typed_data(usdc_address=USDC_SEPOLIA, chain_id=16602, authorization=auth)
    signed = Account.sign_typed_data(signer_account.key, full_message=typed)
    sig = signed.signature.hex()
    if not sig.startswith("0x"):
        sig = "0x" + sig
    return auth, sig


@pytest.fixture
def env_for_app(monkeypatch):
    monkeypatch.setenv("SEPOLIA_RPC_URL", "http://127.0.0.1:0")  # never reached in unit tests
    monkeypatch.setenv("RELAYER_PRIVATE_KEY", "0x" + "44" * 32)
    monkeypatch.setenv("USDC_ADDRESS", USDC_SEPOLIA)
