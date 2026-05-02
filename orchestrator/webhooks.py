import json

from fastapi import APIRouter, Header, HTTPException, Request

from .settings import get_settings
from .webhook_verifier import verify_webhook


def build_router(economics) -> APIRouter:
    router = APIRouter()
    settings = get_settings()

    @router.post("/webhooks/keeperhub")
    async def kh_webhook(
        request: Request,
        x_keeperhub_signature: str = Header(...),
    ):
        body = await request.body()
        if not verify_webhook(
            settings.keeperhub_webhook_secret, body, x_keeperhub_signature
        ):
            raise HTTPException(401, "invalid signature")
        payload = json.loads(body)
        event = payload.get("event")
        handler = {
            "coalition_proposed": economics.on_coalition_proposed,
            "coalition_activated": economics.on_coalition_activated,
            "payment_pool_ready": economics.on_payment_pool_ready,
            "stream_started": getattr(economics, "on_stream_started", None),
            "stream_stopped": getattr(economics, "on_stream_stopped", None),
            "coalition_dissolved": getattr(economics, "on_coalition_dissolved", None),
        }.get(event)
        if handler is None:
            return {"received": True, "ignored": True}
        await handler(payload)
        return {"received": True}

    return router
