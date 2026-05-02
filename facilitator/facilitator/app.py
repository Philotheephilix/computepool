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


class Authorization(BaseModel):
    from_: str
    to: str
    value: str
    validAfter: str
    validBefore: str
    nonce: str

    class Config:
        populate_by_name = True
        # Allow `from` instead of `from_` since `from` is reserved
        fields = {"from_": "from"}


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

    # 1. Signer recovery
    try:
        signer = recover_signer(
            usdc_address=settings.usdc_address,
            chain_id=settings.chain_id,
            authorization=auth,
            signature=sig,
        )
    except Exception as e:
        return VerifyResponse(isValid=False, invalidReason=f"signature parse: {e}")

    if signer.lower() != auth["from"].lower():
        return VerifyResponse(isValid=False, invalidReason="signer mismatch")

    # 2. Window
    now = int(time.time())
    if not (int(auth["validAfter"]) <= now < int(auth["validBefore"])):
        return VerifyResponse(isValid=False, invalidReason="window expired")

    # 3. Amount + payTo
    if int(auth["value"]) < int(req.paymentRequirements.maxAmountRequired):
        return VerifyResponse(isValid=False, invalidReason="amount insufficient")
    if auth["to"].lower() != req.paymentRequirements.payTo.lower():
        return VerifyResponse(isValid=False, invalidReason="payTo mismatch")
    if req.paymentRequirements.asset.lower() != settings.usdc_address.lower():
        return VerifyResponse(isValid=False, invalidReason="asset mismatch")

    # 4. On-chain checks
    if await chain.is_nonce_used(auth["from"], auth["nonce"]):
        return VerifyResponse(isValid=False, invalidReason="nonce used")
    if await chain.usdc_balance(auth["from"]) < int(auth["value"]):
        return VerifyResponse(isValid=False, invalidReason="balance insufficient")

    return VerifyResponse(isValid=True, payer=auth["from"])
