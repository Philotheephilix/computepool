import os
import pytest
from eth_account import Account

from orchestrator.inft.crypto import seal_to_pubkey, unseal_with_privkey, encrypt, decrypt


def test_aes_roundtrip():
    key = os.urandom(32)
    pt = b'{"model_id":"x"}'
    ct = encrypt(key, pt)
    assert decrypt(key, ct) == pt


def test_ecies_seal_unseal():
    acct = Account.create()
    aes_key = os.urandom(32)
    pub_uncompressed = bytes.fromhex(acct._key_obj.public_key.to_hex().removeprefix("0x"))
    sealed = seal_to_pubkey(pub_uncompressed, aes_key)
    unsealed = unseal_with_privkey(acct.key, sealed)
    assert unsealed == aes_key


def test_decrypt_wrong_key_raises():
    pt = b"hi"
    ct = encrypt(os.urandom(32), pt)
    with pytest.raises(Exception):
        decrypt(os.urandom(32), ct)
