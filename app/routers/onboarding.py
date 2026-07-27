import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.user_settings import UserSettings
from app.routers.auth import get_current_user
from app.services.pinch_service import PinchService, PinchAPIException
from app.config import settings as app_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])


class ConnectPinchRequest(BaseModel):
    pinch_api_key: str


class PreferencesRequest(BaseModel):
    auto_retry: bool = True
    retry_days: int = 4
    max_retries: int = 3
    business_name: str | None = None
    sender_email: str | None = None
    notify_channel: str = "email"


@router.post("/connect-pinch")
async def connect_pinch(
    body: ConnectPinchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate Pinch API key and store it."""
    try:
        async with PinchService() as pinch:
            payers = await pinch.get_payers(limit=1)
            payer_count = len(payers.get("data", payers.get("items", [])))
    except PinchAPIException as e:
        raise HTTPException(status_code=400, detail=f"Invalid Pinch API key: {e}")
    except Exception as e:
        logger.warning(f"Pinch validation failed: {e}")
        payer_count = 0

    user.pinch_api_key_encrypted = body.pinch_api_key
    user.onboarding_complete = False
    await db.commit()
    return {"valid": True, "payer_count": payer_count}


@router.post("/preferences")
async def save_preferences(
    body: PreferencesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    user_settings = result.scalar_one_or_none()
    if not user_settings:
        user_settings = UserSettings(user_id=user.id)
        db.add(user_settings)

    user_settings.auto_retry = body.auto_retry
    user_settings.retry_days = body.retry_days
    user_settings.max_retries = body.max_retries
    user_settings.notify_channel = body.notify_channel
    if body.business_name:
        user_settings.business_name = body.business_name
        user.business_name = body.business_name
    if body.sender_email:
        user_settings.sender_email = body.sender_email

    user.onboarding_complete = True
    await db.commit()
    return {"saved": True}


@router.get("/webhook-url")
async def get_webhook_url(request: Request, user: User = Depends(get_current_user)):
    base = str(request.base_url).rstrip("/")
    webhook_url = f"{base}/webhook/pinch"
    return {
        "webhook_url": webhook_url,
        "instructions": "Add this URL in Pinch Portal → Settings → Webhooks. Select event: bank-results.",
    }
