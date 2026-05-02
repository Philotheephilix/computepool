from typing import TypedDict
from eth_account import Account
from eth_account.messages import encode_typed_data


class Authorization(TypedDict):
    from_: str
    to: str
    value: str
    validAfter: str
    validBefore: str
    nonce: str  # 0x-prefixed 32 bytes


USDC_TRANSFER_AUTH_TYPES = {
    "EIP712Domain": [
        {"name": "name", "type": "string"},
        {"name": "version", "type": "string"},
        {"name": "chainId", "type": "uint256"},
        {"name": "verifyingContract", "type": "address"},
    ],
    "TransferWithAuthorization": [
        {"name": "from", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "validAfter", "type": "uint256"},
        {"name": "validBefore", "type": "uint256"},
        {"name": "nonce", "type": "bytes32"},
    ],
}


def build_typed_data(*, usdc_address: str, chain_id: int, authorization: dict,
                     domain_name: str = "USDC", domain_version: str = "2") -> dict:
    return {
        "types": USDC_TRANSFER_AUTH_TYPES,
        "domain": {
            "name": domain_name,
            "version": domain_version,
            "chainId": chain_id,
            "verifyingContract": usdc_address,
        },
        "primaryType": "TransferWithAuthorization",
        "message": {
            "from": authorization["from"],
            "to": authorization["to"],
            "value": int(authorization["value"]),
            "validAfter": int(authorization["validAfter"]),
            "validBefore": int(authorization["validBefore"]),
            "nonce": bytes.fromhex(authorization["nonce"][2:]),
        },
    }


def recover_signer(usdc_address: str, chain_id: int, authorization: dict, signature: str,
                   domain_name: str = "USDC", domain_version: str = "2") -> str:
    typed = build_typed_data(
        usdc_address=usdc_address, chain_id=chain_id, authorization=authorization,
        domain_name=domain_name, domain_version=domain_version,
    )
    msg = encode_typed_data(full_message=typed)
    return Account.recover_message(msg, signature=signature)


def split_signature(signature_hex: str) -> tuple[int, bytes, bytes]:
    raw = bytes.fromhex(signature_hex[2:] if signature_hex.startswith("0x") else signature_hex)
    if len(raw) != 65:
        raise ValueError(f"signature must be 65 bytes, got {len(raw)}")
    r = raw[0:32]
    s = raw[32:64]
    v = raw[64]
    if v < 27:
        v += 27
    return v, r, s
