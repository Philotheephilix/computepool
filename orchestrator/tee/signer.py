import hashlib
from dataclasses import dataclass

from eth_account import Account
from eth_account.messages import encode_defunct


@dataclass
class TEESigner:
    _account: Account
    insecure: bool

    @classmethod
    def dev_from_key(cls, key: bytes) -> "TEESigner":
        """Create a dev signer from a raw 32-byte private key. Marks insecure=True."""
        return cls(_account=Account.from_key(key), insecure=True)

    @classmethod
    def from_keyfile(cls, path: str) -> "TEESigner":
        """Read a hex-encoded private key from a mounted secret file. Used in TEE deployments
        where the key is provisioned into the enclave at startup."""
        raw = open(path).read().strip().removeprefix("0x")
        return cls(_account=Account.from_key(bytes.fromhex(raw)), insecure=False)

    @property
    def address(self) -> str:
        return self._account.address

    @staticmethod
    def canonical_message(body: bytes) -> str:
        """Verifiers reconstruct this exact string and EIP-191-recover the signer."""
        return "cp:" + hashlib.sha256(body).hexdigest()

    def sign(self, body: bytes) -> bytes:
        msg = encode_defunct(text=self.canonical_message(body))
        return self._account.sign_message(msg).signature
