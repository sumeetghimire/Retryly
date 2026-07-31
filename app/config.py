from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://sumeerghimire@localhost:5432/retryly"
    PINCH_API_KEY: str = ""
    PINCH_APP_ID: str = ""
    PINCH_PUBLISHABLE_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEMO_MODE: bool = True
    APP_ENV: str = "development"
    PINCH_WEBHOOK_SECRET: str = ""
    PINCH_MODE: str = "test"  # "test" or "live" — determines which Pinch environment to use
    # Base URL is always https://api.getpinch.com.au; mode is appended as /test/ or /live/
    PINCH_BASE_URL: str = "https://api.getpinch.com.au"  # kept for backward compat, mode prefix applied at runtime

    # Managed Merchant (platform-level Pinch credentials)
    PINCH_MASTER_API_KEY: str = ""   # Retryly's own Pinch API key for creating sub-merchants
    PINCH_MASTER_APP_ID: str = ""    # Retryly's own Pinch App ID

    # Fernet key for encrypting API keys at rest.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # MUST be set in production. If empty, an ephemeral key is used (dev only).
    ENCRYPTION_KEY: str = ""

    # Email (SendGrid)
    SENDGRID_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@retryly.com.au"
    FROM_NAME: str = "Retryly"

    class Config:
        env_file = ".env"


settings = Settings()
