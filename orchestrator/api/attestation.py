from fastapi import APIRouter

from orchestrator.tee.attestation import get_quote
from orchestrator.tee.signer import TEESigner


def build_router(signer: TEESigner) -> APIRouter:
    r = APIRouter()

    @r.get("/v1/attestation")
    async def attestation():
        report_type, quote = get_quote(signer)
        return {
            "signer": signer.address,
            "report": quote,
            "report_type": report_type,
        }

    return r
