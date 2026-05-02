#!/usr/bin/env python3
"""Sign an x402 PaymentPayload for the demo. Usage:

    DEMO_PAYER_KEY=0x... \\
    ORCHESTRATOR_WALLET_ADDRESS=0x... \\
    USDC_ADDRESS=0x... \\
    AMOUNT_MICRO=10000 \\
    RESOURCE=/pools/demo/infer \\
    python scripts/sign_payment.py
"""
import base64
import json
import os
import secrets
import sys
import time
from eth_account import Account
from eth_account.messages import encode_typed_data


def main() -> int:
    key = os.environ["DEMO_PAYER_KEY"]
    pay_to = os.environ["ORCHESTRATOR_WALLET_ADDRESS"]
    usdc = os.environ["USDC_ADDRESS"]
    amount = os.environ.get("AMOUNT_MICRO", "10000")
    chain_id = int(os.environ.get("CHAIN_ID", "16602"))

    acct = Account.from_key(key)
    auth = {
        "from": acct.address,
        "to": pay_to,
        "value": amount,
        "validAfter": "0",
        "validBefore": str(int(time.time()) + 600),
        "nonce": "0x" + secrets.token_hex(32),
    }
    typed = {
        "types": {
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
        },
        "domain": {
            "name": os.environ.get("USDC_DOMAIN_NAME", "USDC"),
            "version": os.environ.get("USDC_DOMAIN_VERSION", "2"),
            "chainId": chain_id, "verifyingContract": usdc,
        },
        "primaryType": "TransferWithAuthorization",
        "message": {
            "from": auth["from"], "to": auth["to"],
            "value": int(auth["value"]),
            "validAfter": int(auth["validAfter"]),
            "validBefore": int(auth["validBefore"]),
            "nonce": bytes.fromhex(auth["nonce"][2:]),
        },
    }
    signed = Account.sign_typed_data(acct.key, full_message=typed)
    sig = signed.signature.hex()
    if not sig.startswith("0x"):
        sig = "0x" + sig

    payload = {
        "x402Version": 1, "scheme": "exact", "network": "0g-galileo",
        "payload": {"signature": sig, "authorization": auth},
    }
    sys.stdout.write(base64.b64encode(json.dumps(payload).encode()).decode())
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
