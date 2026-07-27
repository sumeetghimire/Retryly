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

    class Config:
        env_file = ".env"


settings = Settings()
