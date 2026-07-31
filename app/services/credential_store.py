"""
In-process credential store for the active Pinch connection.

When a user connects via API key, their decrypted credentials are cached here
so that background tasks (process_dishonours, etc.) can call PinchService with
the correct key rather than falling back to the global .env values.

On server restart, load_credentials_from_db() is called from main.py startup
to repopulate from the last connected user.
"""
import logging
from app.config import settings as _settings

logger = logging.getLogger(__name__)

_store: dict[str, str] = {}


def set_active_credentials(api_key: str, app_id: str, mode: str = "test") -> None:
    _store["api_key"] = api_key
    _store["app_id"] = app_id
    _store["mode"] = mode
    logger.info(f"Credential store updated: mode={mode}, app_id={app_id[:8]}…")


def get_active_credentials() -> tuple[str | None, str | None, str]:
    """Return (api_key, app_id, mode) from store, falling back to settings."""
    return (
        _store.get("api_key") or _settings.PINCH_API_KEY,
        _store.get("app_id") or _settings.PINCH_APP_ID,
        _store.get("mode") or getattr(_settings, "PINCH_MODE", "test") or "test",
    )


async def load_credentials_from_db(db) -> None:
    """
    Called at startup. Finds the most recently connected user with API key
    credentials and loads them into the store so background tasks work after
    a restart without requiring a new connection.
    """
    try:
        from sqlalchemy import select
        from app.models.user import User
        from app.routers.onboarding import decrypt_key

        result = await db.execute(
            select(User)
            .where(User.pinch_api_key_encrypted.isnot(None))
            .where(User.pinch_merchant_status == "active")
            .where(User.onboarding_type == "api_key")
            .order_by(User.id.desc())
            .limit(1)
        )
        user = result.scalar_one_or_none()
        if user and user.pinch_api_key_encrypted:
            api_key = decrypt_key(user.pinch_api_key_encrypted)
            # pinch_merchant_id stored as "mode|app_id"
            mode, app_id = "test", ""
            if user.pinch_merchant_id and "|" in user.pinch_merchant_id:
                mode, app_id = user.pinch_merchant_id.split("|", 1)
            set_active_credentials(api_key, app_id, mode)
            logger.info(f"Loaded credentials from DB for user {user.id} on startup")
    except Exception as e:
        logger.warning(f"Could not load credentials from DB on startup: {e}")
