from eth_account import Account
from facilitator.eip3009 import (
    build_typed_data,
    recover_signer,
    split_signature,
)


USDC_SEPOLIA = "0xa1B71D35B9B46BA5b8f579B8e5d97C3497678189"


def test_recover_signer_roundtrip():
    """Sign and recover; the recovered address must equal the signer."""
    acct = Account.create()
    auth = {
        "from": acct.address,
        "to": "0x000000000000000000000000000000000000bEEF",
        "value": "1000000",
        "validAfter": "0",
        "validBefore": "9999999999",
        "nonce": "0x" + "ab" * 32,
    }
    typed = build_typed_data(usdc_address=USDC_SEPOLIA, chain_id=16602, authorization=auth)
    signed = Account.sign_typed_data(acct.key, full_message=typed)
    sig_hex = signed.signature.hex()
    if not sig_hex.startswith("0x"):
        sig_hex = "0x" + sig_hex

    recovered = recover_signer(USDC_SEPOLIA, 16602, auth, sig_hex)
    assert recovered.lower() == acct.address.lower()


def test_split_signature():
    sig = "0x" + "11" * 32 + "22" * 32 + "1b"
    v, r, s = split_signature(sig)
    assert v == 27
    assert r == bytes.fromhex("11" * 32)
    assert s == bytes.fromhex("22" * 32)
