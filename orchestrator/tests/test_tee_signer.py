from eth_account import Account
from eth_account.messages import encode_defunct

from orchestrator.tee.signer import TEESigner


def test_dev_signer_signs_and_recovers():
    s = TEESigner.dev_from_key(b"\x11" * 32)
    body = b"hello world"
    sig = s.sign(body)
    recovered = Account.recover_message(
        encode_defunct(text=s.canonical_message(body)),
        signature=sig,
    )
    assert recovered.lower() == s.address.lower()


def test_canonical_message_is_sha256_prefixed():
    import hashlib
    s = TEESigner.dev_from_key(b"\x22" * 32)
    body = b"abc"
    expected = "cp:" + hashlib.sha256(body).hexdigest()
    assert s.canonical_message(body) == expected


def test_dev_signer_marks_insecure():
    s = TEESigner.dev_from_key(b"\x33" * 32)
    assert s.insecure is True
