import time
from fastapi import FastAPI
from pydantic import BaseModel
from .settings import get_settings
from .chain import Chain
from .eip3009 import recover_signer, split_signature


settings = get_settings()
chain = Chain(
    rpc_url=settings.sepolia_rpc_url,
    usdc_address=settings.usdc_address,
    relayer_private_key=settings.relayer_private_key,
)
app = FastAPI(title="ComputePool x402 Facilitator")


class PaymentPayload(BaseModel):
    x402Version: int
    scheme: str
    network: str
    payload: dict


class PaymentRequirements(BaseModel):
    scheme: str
    network: str
    maxAmountRequired: str
    resource: str
    description: str
    mimeType: str
    payTo: str
    maxTimeoutSeconds: int
    asset: str
    extra: dict | None = None


class VerifyRequest(BaseModel):
    x402Version: int
    paymentPayload: PaymentPayload
    paymentRequirements: PaymentRequirements


class VerifyResponse(BaseModel):
    isValid: bool
    invalidReason: str | None = None
    payer: str | None = None


class SettleRequest(VerifyRequest):
    pass


class SettleResponse(BaseModel):
    success: bool
    transaction: str | None = None
    network: str = "sepolia"
    payer: str | None = None
    errorReason: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/verify", response_model=VerifyResponse)
async def verify(req: VerifyRequest) -> VerifyResponse:
    auth = req.paymentPayload.payload["authorization"]
    sig = req.paymentPayload.payload["signature"]
    extra = req.paymentRequirements.extra or {}

    try:
        signer = recover_signer(
            usdc_address=settings.usdc_address,
            chain_id=settings.chain_id,
            authorization=auth,
            signature=sig,
            domain_name=extra.get("name", "USD Coin"),
            domain_version=extra.get("version", "2"),
        )
    except Exception as e:
        return VerifyResponse(isValid=False, invalidReason=f"signature parse: {e}")

    if signer.lower() != auth["from"].lower():
        return VerifyResponse(isValid=False, invalidReason="signer mismatch")

    now = int(time.time())
    if not (int(auth["validAfter"]) <= now < int(auth["validBefore"])):
        return VerifyResponse(isValid=False, invalidReason="window expired")

    if int(auth["value"]) < int(req.paymentRequirements.maxAmountRequired):
        return VerifyResponse(isValid=False, invalidReason="amount insufficient")
    if auth["to"].lower() != req.paymentRequirements.payTo.lower():
        return VerifyResponse(isValid=False, invalidReason="payTo mismatch")
    if req.paymentRequirements.asset.lower() != settings.usdc_address.lower():
        return VerifyResponse(isValid=False, invalidReason="asset mismatch")

    if await chain.is_nonce_used(auth["from"], auth["nonce"]):
        return VerifyResponse(isValid=False, invalidReason="nonce used")
    if await chain.usdc_balance(auth["from"]) < int(auth["value"]):
        return VerifyResponse(isValid=False, invalidReason="balance insufficient")

    return VerifyResponse(isValid=True, payer=auth["from"])


@app.post("/settle", response_model=SettleResponse)
async def settle(req: SettleRequest) -> SettleResponse:
    auth = req.paymentPayload.payload["authorization"]
    sig = req.paymentPayload.payload["signature"]
    v, r_bytes, s_bytes = split_signature(sig)
    nonce = bytes.fromhex(auth["nonce"][2:] if auth["nonce"].startswith("0x") else auth["nonce"])
    try:
        result = await chain.submit_transfer_with_authorization(
            frm=auth["from"],
            to=auth["to"],
            value=int(auth["value"]),
            valid_after=int(auth["validAfter"]),
            valid_before=int(auth["validBefore"]),
            nonce=nonce,
            v=v, r=r_bytes, s=s_bytes,
        )
    except Exception as e:
        return SettleResponse(success=False, errorReason=str(e), payer=auth["from"])

    return SettleResponse(
        success=result["status"] == 1,
        transaction=result["tx_hash"],
        payer=auth["from"],
        network="sepolia",
    )
