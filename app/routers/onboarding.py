# PRODUCTION ARCHITECTURE NOTE
# ─────────────────────────────────────────────────────
# In this hackathon build, users can connect via:
#   A) Managed Merchant (recommended) — Retryly creates
#      a Pinch sub-merchant account on their behalf.
#      No API keys, no developer portal, no friction.
#      SMB just enters their ABN and business details.
#   B) API Key (demo fallback) — for existing Pinch
#      merchants who want to connect immediately.
#
# In production at scale, Option A is the default.
# Retryly operates as a Pinch PayFac platform,
# onboarding every SMB as a managed sub-merchant
# via Pinch's Glassbox/Managed Merchant API.
# The SMB experience: sign up → enter ABN →
# account active in 24hrs → start recovering payments.
# No technical knowledge required.
# ─────────────────────────────────────────────────────

import logging
from cryptography.fernet import Fernet

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

# ── Encryption helpers ────────────────────────────────────────────────────────

_ephemeral_key: bytes | None = None


def _get_fernet() -> Fernet:
    global _ephemeral_key
    key = app_settings.ENCRYPTION_KEY
    if key:
        return Fernet(key.encode() if isinstance(key, str) else key)
    # Dev fallback: generate once per process (not safe for prod)
    if _ephemeral_key is None:
        _ephemeral_key = Fernet.generate_key()
        logger.warning(
            "ENCRYPTION_KEY not set — using ephemeral key (dev only). "
            "Set ENCRYPTION_KEY in .env for production."
        )
    return Fernet(_ephemeral_key)


def encrypt_key(raw_key: str) -> str:
    return _get_fernet().encrypt(raw_key.encode()).decode()


def decrypt_key(encrypted_key: str) -> str:
    return _get_fernet().decrypt(encrypted_key.encode()).decode()


def _mask_key(raw_key: str) -> str:
    """Return a masked representation: sk_live_••••••••••••1234"""
    if len(raw_key) >= 8:
        return raw_key[:8] + "•" * 10 + raw_key[-4:]
    return "•" * len(raw_key)


def get_current_merchant_key(user: User) -> str:
    """
    Return the decrypted Pinch API key for this user.
    Used by endpoints that need to call Pinch on behalf of the user.
    """
    if not user.pinch_api_key_encrypted:
        raise HTTPException(status_code=403, detail="Pinch account not connected")
    if user.onboarding_type == "managed" and user.pinch_merchant_status != "active":
        raise HTTPException(status_code=403, detail="Pinch account not yet active")
    return decrypt_key(user.pinch_api_key_encrypted)


# ── Request/Response schemas ──────────────────────────────────────────────────

class ConnectPinchRequest(BaseModel):
    pinch_api_key: str


class ConnectApiKeyRequest(BaseModel):
    pinch_api_key: str   # Secret Key
    pinch_app_id: str    # Merchant ID / Application ID (mch_...)
    mode: str = "test"   # "test" or "live"


class CreateMerchantRequest(BaseModel):
    business_name: str
    abn: str
    contact_first_name: str
    contact_last_name: str
    contact_phone: str


class PreferencesRequest(BaseModel):
    auto_retry: bool = True
    retry_days: int = 4
    max_retries: int = 3
    business_name: str | None = None
    sender_email: str | None = None
    notify_channel: str = "email"


# ── Existing endpoint (kept for backward compatibility) ───────────────────────

@router.post("/connect-pinch")
async def connect_pinch(
    body: ConnectPinchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Legacy endpoint — validate Pinch API key and store it."""
    try:
        async with PinchService() as pinch:
            payers = await pinch.get_payers(limit=1)
            payer_count = len(payers.get("data", payers.get("items", [])))
    except PinchAPIException as e:
        raise HTTPException(status_code=400, detail=f"Invalid Pinch API key: {e}")
    except Exception as e:
        logger.warning(f"Pinch validation failed: {e}")
        payer_count = 0

    user.pinch_api_key_encrypted = encrypt_key(body.pinch_api_key)
    user.onboarding_type = "api_key"
    user.pinch_merchant_status = "active"
    await db.commit()
    return {"valid": True, "payer_count": payer_count}


# ── New endpoint: API Key path ────────────────────────────────────────────────

@router.post("/connect-api-key")
async def connect_api_key(
    request: Request,
    body: ConnectApiKeyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate a Pinch API key provided by the user, store it encrypted, and
    automatically register Retryly's webhook with Pinch — so the SMB never
    has to touch their Pinch portal.
    """
    raw_key = body.pinch_api_key.strip()
    raw_app_id = body.pinch_app_id.strip()
    mode = body.mode if body.mode in ("test", "live") else "test"
    payer_count = 0
    merchant_name = user.business_name

    try:
        async with PinchService(api_key=raw_key, app_id=raw_app_id, mode=mode) as pinch:
            payers = await pinch.get_payers(limit=50)
            items = payers.get("data", payers.get("items", []))
            payer_count = len(items)

            # Auto-register webhook — SMB never needs to configure this manually
            webhook_url = str(request.base_url).rstrip("/") + "/webhook/pinch"
            try:
                await pinch.register_webhook(webhook_url, events=["bank-results"])
                logger.info(f"Webhook registered automatically for user {user.id}: {webhook_url}")
            except Exception as e:
                # Non-fatal: log and continue. User can register manually if needed.
                logger.warning(f"Auto-webhook registration failed for user {user.id}: {e}")

    except PinchAPIException as e:
        logger.warning(f"API key validation failed for user {user.id}: status={e.status_code}")
        return {
            "valid": False,
            "message": "Could not connect to Pinch. Check your API key and try again.",
        }
    except Exception as e:
        logger.warning(f"API key validation error for user {user.id}: {e}")
        return {
            "valid": False,
            "message": "Could not connect to Pinch. Check your API key and try again.",
        }

    user.pinch_api_key_encrypted = encrypt_key(raw_key)
    user.pinch_merchant_id = f"{mode}|{raw_app_id}"  # store mode + merchant ID
    user.onboarding_type = "api_key"
    user.pinch_merchant_status = "active"
    await db.commit()

    # Update in-process credential store so background tasks use the right key
    from app.services.credential_store import set_active_credentials
    set_active_credentials(raw_key, raw_app_id, mode)

    # Sync payers + their recent scheduled payments into local DB
    synced_payers, synced_payments = 0, 0
    try:
        from app.models.payer import Payer
        from app.models.payment import Payment
        from sqlalchemy import select as sa_select

        async with PinchService(api_key=raw_key, app_id=raw_app_id, mode=mode) as pinch:
            payer_resp = await pinch.get_payers(limit=200)
            pinch_payers = payer_resp.get("data", payer_resp.get("items", []))

            for p in pinch_payers:
                pinch_id = str(p.get("id", ""))
                if not pinch_id:
                    continue
                first = p.get("firstName", "") or p.get("first_name", "")
                last = p.get("lastName", "") or p.get("last_name", "")
                full_name = p.get("name") or f"{first} {last}".strip() or "Unknown"
                email = p.get("email", "") or ""
                phone = p.get("phone") or p.get("mobileNumber") or None

                existing = await db.execute(
                    sa_select(Payer).where(Payer.pinch_payer_id == pinch_id)
                )
                payer_row = existing.scalar_one_or_none()
                if payer_row:
                    payer_row.name = full_name
                    payer_row.email = email
                else:
                    payer_row = Payer(
                        pinch_payer_id=pinch_id,
                        name=full_name,
                        email=email,
                        phone=phone,
                        payment_history={"on_time": 0, "failures": 0},
                    )
                    db.add(payer_row)
                synced_payers += 1

            await db.commit()

            # Sync recent scheduled/pending payments for cash flow forecast
            try:
                pay_resp = await pinch.get_payments(limit=200, status="scheduled")
                pinch_payments = pay_resp.get("data", pay_resp.get("items", []))
                for pp in pinch_payments:
                    pinch_pay_id = str(pp.get("id", ""))
                    if not pinch_pay_id:
                        continue
                    existing_pay = await db.execute(
                        sa_select(Payment).where(Payment.pinch_payment_id == pinch_pay_id)
                    )
                    if existing_pay.scalar_one_or_none():
                        continue
                    payer_id_str = str(pp.get("payerId", "") or "")
                    payer_db = await db.execute(
                        sa_select(Payer).where(Payer.pinch_payer_id == payer_id_str)
                    )
                    payer_db_row = payer_db.scalar_one_or_none()
                    if not payer_db_row:
                        continue
                    pay_obj = Payment(
                        payer_id=payer_db_row.id,
                        pinch_payment_id=pinch_pay_id,
                        amount_cents=int(pp.get("amount", 0)),
                        status="scheduled",
                        scheduled_at=None,
                    )
                    db.add(pay_obj)
                    synced_payments += 1
                await db.commit()
            except Exception as e:
                logger.warning(f"Payment sync failed (non-fatal): {e}")

    except Exception as e:
        logger.warning(f"Payer sync failed (non-fatal): {e}")

    return {
        "valid": True,
        "payer_count": payer_count,
        "synced_payers": synced_payers,
        "synced_payments": synced_payments,
        "merchant_name": merchant_name,
        "masked_key": _mask_key(raw_key),
    }


# ── New endpoint: Managed Merchant path ──────────────────────────────────────

@router.post("/create-merchant")
async def create_merchant(
    body: CreateMerchantRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Pinch sub-merchant on behalf of the user (managed merchant model).
    Retryly uses its own master Pinch API key — the SMB never sees any API key.
    Pinch activates the merchant within ~24 hours via KYC.
    """
    master_key = app_settings.PINCH_MASTER_API_KEY or app_settings.PINCH_API_KEY
    master_app_id = app_settings.PINCH_MASTER_APP_ID or app_settings.PINCH_APP_ID

    business_details = {
        "business_name": body.business_name or user.business_name,
        "abn": body.abn,
        "contact_email": user.email,
        "contact_phone": body.contact_phone,
        "contact_first_name": body.contact_first_name,
        "contact_last_name": body.contact_last_name,
    }

    import uuid

    # For the sandbox / hackathon build, the Pinch managed merchant (PayFac)
    # API is not available on standard accounts. We use the sandbox PINCH_API_KEY
    # from settings directly and activate the merchant immediately so the demo
    # flow works end-to-end without a pending/KYC step.
    sandbox_key = app_settings.PINCH_API_KEY
    if sandbox_key:
        user.pinch_api_key_encrypted = encrypt_key(sandbox_key)

    merchant_id = f"sandbox_{uuid.uuid4().hex[:12]}"
    user.pinch_merchant_id = merchant_id
    user.pinch_merchant_status = "active"
    user.onboarding_type = "managed"
    if body.business_name:
        user.business_name = body.business_name
    await db.commit()

    logger.info(f"Sandbox merchant created for user {user.id}: {merchant_id}")

    return {
        "merchant_id": merchant_id,
        "status": "active",
        "message": "Your account is connected and ready.",
    }


@router.get("/merchant-status")
async def merchant_status(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Poll Pinch for managed merchant activation status.
    When active, saves the merchant's API key encrypted to the DB.
    """
    if not user.pinch_merchant_id:
        return {"status": user.pinch_merchant_status or "pending"}

    # Simulated merchant — mark active immediately (demo/hackathon mode)
    if user.pinch_merchant_id.startswith("sim_"):
        if user.pinch_merchant_status != "active":
            user.pinch_api_key_encrypted = encrypt_key(
                app_settings.PINCH_API_KEY or "demo_key"
            )
            user.pinch_merchant_status = "active"
            await db.commit()
        return {"status": "active"}

    master_key = app_settings.PINCH_MASTER_API_KEY or app_settings.PINCH_API_KEY
    master_app_id = app_settings.PINCH_MASTER_APP_ID or app_settings.PINCH_APP_ID

    try:
        async with PinchService(api_key=master_key, app_id=master_app_id) as pinch:
            result = await pinch.get_managed_merchant_status(user.pinch_merchant_id)
    except Exception as e:
        logger.warning(f"Merchant status check failed for user {user.id}: {e}")
        return {"status": user.pinch_merchant_status or "pending"}

    activation_status = (
        result.get("activationStatus")
        or result.get("status")
        or "pending"
    ).lower()

    if activation_status == "active":
        api_key = result.get("apiKey") or result.get("api_key")
        if api_key:
            user.pinch_api_key_encrypted = encrypt_key(api_key)
            # Auto-register webhook with the merchant's new API key
            webhook_url = str(request.base_url).rstrip("/") + "/webhook/pinch"
            try:
                async with PinchService(api_key=api_key) as pinch:
                    await pinch.register_webhook(webhook_url, events=["bank-results"])
                logger.info(f"Webhook registered for managed merchant user {user.id}")
            except Exception as e:
                logger.warning(f"Auto-webhook registration failed for managed merchant {user.id}: {e}")
        user.pinch_merchant_status = "active"
        await db.commit()
        return {"status": "active"}

    if activation_status in ("rejected", "declined", "failed"):
        user.pinch_merchant_status = "rejected"
        await db.commit()
        return {
            "status": "rejected",
            "message": "Your account could not be verified. Please contact support.",
        }

    return {"status": "pending"}


# ── Existing endpoints ────────────────────────────────────────────────────────

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
