import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ecies import encrypt as _ecies_enc, decrypt as _ecies_dec

NONCE_LEN = 12


def encrypt(key: bytes, plaintext: bytes, aad: bytes | None = None) -> bytes:
    """AES-GCM-256: returns nonce(12) || ciphertext(includes auth tag)."""
    if len(key) != 32:
        raise ValueError("key must be 32 bytes")
    nonce = os.urandom(NONCE_LEN)
    ct = AESGCM(key).encrypt(nonce, plaintext, aad)
    return nonce + ct


def decrypt(key: bytes, blob: bytes, aad: bytes | None = None) -> bytes:
    nonce, ct = blob[:NONCE_LEN], blob[NONCE_LEN:]
    return AESGCM(key).decrypt(nonce, ct, aad)


def seal_to_pubkey(pubkey_uncompressed: bytes, aes_key: bytes) -> bytes:
    """ECIES-encrypt `aes_key` to a secp256k1 pubkey.
    Accepts either 64-byte raw uncompressed (no prefix) or 65-byte (with 0x04 prefix)."""
    if len(pubkey_uncompressed) == 64:
        pubkey_uncompressed = b"\x04" + pubkey_uncompressed
    return _ecies_enc(pubkey_uncompressed, aes_key)


def unseal_with_privkey(privkey: bytes, sealed: bytes) -> bytes:
    return _ecies_dec(privkey, sealed)
