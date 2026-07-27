import hashlib
import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_signature(body: bytes, signature: str | None) -> bool:
    """Verify Pinch webhook HMAC-SHA256 signature. Skip if no secret configured."""
    if not settings.PINCH_WEBHOOK_SECRET:
        return True
    if not signature:
        return False
    expected = hmac.new(
        settings.PINCH_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()  # type: ignore
    return hmac.compare_digest(expected, signature.removeprefix("sha256="))


@router.post("/webhook/pinch")
async def pinch_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    signature = request.headers.get("x-pinch-signature") or request.headers.get("x-hub-signature-256")

    if not _verify_signature(body, signature):
        logger.warning("Pinch webhook signature verification failed")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        import json
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    logger.info(f"Received Pinch webhook: {str(payload)[:500]}")

    from app.tasks.process_dishonours import process_dishonours
    background_tasks.add_task(process_dishonours, payload, db)

    return {"status": "received"}
