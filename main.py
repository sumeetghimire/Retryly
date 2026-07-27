from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import webhook, dashboard, dishonours, payers, demo, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Retryly",
    description="Every failed payment is a second chance. Automatic payment recovery, powered by Pinch.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://ghivo.online",
        "https://www.ghivo.online",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router, tags=["Webhook"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(dishonours.router, prefix="/api", tags=["Dishonours"])
app.include_router(payers.router, prefix="/api", tags=["Payers"])
app.include_router(demo.router, prefix="/api", tags=["Demo"])
app.include_router(export.router, prefix="/api", tags=["Export"])


@app.get("/api/health", tags=["Health"])
async def health():
    from app.config import settings
    from app.services.pinch_service import PinchService
    from app.services.claude_service import ClaudeService
    from sqlalchemy import text
    from app.database import AsyncSessionLocal

    pinch_status = "error"
    claude_status = "error"
    db_status = "error"

    try:
        async with PinchService() as svc:
            await svc.get_events(limit=1)
        pinch_status = "connected"
    except Exception:
        pinch_status = "error"

    try:
        svc = ClaudeService()
        await svc.ping()
        claude_status = "connected"
    except Exception:
        claude_status = "error"

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "error"

    return {
        "pinch": pinch_status,
        "claude": claude_status,
        "database": db_status,
        "environment": settings.APP_ENV,
        "demo_mode": settings.DEMO_MODE,
    }
