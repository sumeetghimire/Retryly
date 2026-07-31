import logging
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models.user import User
from app.models.user_settings import UserSettings
from app.models.session import Session
from app.routers.auth import get_current_user
from app.routers.onboarding import encrypt_key, decrypt_key, _mask_key, get_current_merchant_key
from app.services.pinch_service import PinchService, PinchAPIException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["Settings"])


# ── Response helpers ──────────────────────────────────────────────────────────

def _build_settings_response(user: User, user_settings: UserSettings | None):
    pinch_connected = bool(user.pinch_api_key_encrypted)
    masked_key = None
    if pinch_connected and user.onboarding_type == "api_key":
        try:
            raw = decrypt_key(user.pinch_api_key_encrypted)
            masked_key = _mask_key(raw)
        except Exception:
            masked_key = "••••••••••••••••"

    return {
        "profile": {
            "business_name": user.business_name,
            "email": user.email,
        },
        "pinch": {
            "connected": pinch_connected,
            "onboarding_type": user.onboarding_type,
            "merchant_status": user.pinch_merchant_status,
            "merchant_id": user.pinch_merchant_id,
            "masked_key": masked_key,
        },
        "recovery": {
            "auto_retry": user_settings.auto_retry if user_settings else True,
            "retry_days": user_settings.retry_days if user_settings else 4,
            "max_retries": user_settings.max_retries if user_settings else 3,
            "retry_cooldown_days": user_settings.retry_cooldown_days if user_settings else 3,
            "notify_channel": user_settings.notify_channel if user_settings else "email",
            "sender_email": user_settings.sender_email if user_settings else None,
            "business_name_override": user_settings.business_name if user_settings else None,
        },
    }


# ── GET /api/settings ─────────────────────────────────────────────────────────

@router.get("")
async def get_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    user_settings = result.scalar_one_or_none()
    return _build_settings_response(user, user_settings)


# ── PATCH /api/settings/profile ───────────────────────────────────────────────

class ProfileRequest(BaseModel):
    business_name: str


@router.patch("/profile")
async def update_profile(
    body: ProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.business_name = body.business_name.strip()
    # Keep user_settings in sync too
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    user_settings = result.scalar_one_or_none()
    if user_settings:
        user_settings.business_name = user.business_name
    await db.commit()
    return {"saved": True, "business_name": user.business_name}


# ── PATCH /api/settings/recovery ─────────────────────────────────────────────

class RecoveryRequest(BaseModel):
    auto_retry: bool = True
    retry_days: int = 4
    max_retries: int = 3
    retry_cooldown_days: int = 3
    notify_channel: str = "email"
    sender_email: str | None = None


@router.patch("/recovery")
async def update_recovery(
    body: RecoveryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    user_settings = result.scalar_one_or_none()
    if not user_settings:
        user_settings = UserSettings(user_id=user.id)
        db.add(user_settings)

    user_settings.auto_retry = body.auto_retry
    user_settings.retry_days = max(1, min(body.retry_days, 30))
    user_settings.max_retries = max(1, min(body.max_retries, 10))
    user_settings.retry_cooldown_days = max(1, min(body.retry_cooldown_days, 14))
    user_settings.notify_channel = body.notify_channel
    if body.sender_email is not None:
        user_settings.sender_email = body.sender_email.strip() or None
    await db.commit()
    return {"saved": True}


# ── POST /api/settings/connect-pinch ─────────────────────────────────────────

class ConnectRequest(BaseModel):
    pinch_api_key: str
    pinch_app_id: str    # Merchant ID / Application ID
    mode: str = "test"   # "test" or "live"


@router.post("/connect-pinch")
async def reconnect_pinch(
    request: Request,
    body: ConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_key = body.pinch_api_key.strip()
    raw_app_id = body.pinch_app_id.strip()
    mode = body.mode if body.mode in ("test", "live") else "test"
    payer_count = 0
    try:
        async with PinchService(api_key=raw_key, app_id=raw_app_id, mode=mode) as pinch:
            payers = await pinch.get_payers(limit=50)
            items = payers.get("data", payers.get("items", []))
            payer_count = len(items)

            webhook_url = str(request.base_url).rstrip("/") + "/webhook/pinch"
            try:
                await pinch.register_webhook(webhook_url, events=["bank-results"])
            except Exception as e:
                logger.warning(f"Auto-webhook registration failed for user {user.id}: {e}")

    except PinchAPIException as e:
        logger.warning(f"Pinch reconnect validation failed for user {user.id}: {e}")
        return {"valid": False, "message": "Could not connect to Pinch. Check your API key."}
    except Exception as e:
        logger.warning(f"Pinch reconnect error for user {user.id}: {e}")
        return {"valid": False, "message": "Could not connect to Pinch. Check your API key."}

    user.pinch_api_key_encrypted = encrypt_key(raw_key)
    user.pinch_merchant_id = f"{mode}|{raw_app_id}"
    user.onboarding_type = "api_key"
    user.pinch_merchant_status = "active"
    await db.commit()
    return {
        "valid": True,
        "payer_count": payer_count,
        "masked_key": _mask_key(raw_key),
    }


# ── DELETE /api/settings/disconnect-pinch ────────────────────────────────────

@router.delete("/disconnect-pinch")
async def disconnect_pinch(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.pinch_api_key_encrypted = None
    user.pinch_merchant_id = None
    user.pinch_merchant_status = "pending"
    user.onboarding_type = "managed"
    user.onboarding_complete = False
    await db.commit()
    return {"disconnected": True}


# ── DELETE /api/settings/account ─────────────────────────────────────────────

@router.delete("/account")
async def delete_account(
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Delete sessions first
    await db.execute(delete(Session).where(Session.user_id == user.id))
    # Delete user_settings
    await db.execute(delete(UserSettings).where(UserSettings.user_id == user.id))
    # Delete user
    await db.delete(user)
    await db.commit()
    response.delete_cookie("session_token")
    return {"deleted": True}
