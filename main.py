import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.database import init_db
from app.routers import webhook, dashboard, dishonours, payers, demo, export
from app.routers import auth, onboarding, risk, surcharge_advisor

_start_time = time.time()
limiter = Limiter(key_func=get_remote_address)


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
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://ghivo.online",
        "https://www.ghivo.online",
        "https://retryly.com.au",
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
app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(risk.router)
app.include_router(surcharge_advisor.router)


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

    all_ok = all(s == "connected" for s in [pinch_status, claude_status, db_status])
    any_error = any(s == "error" for s in [pinch_status, claude_status, db_status])

    return {
        "status": "healthy" if all_ok else ("degraded" if not any_error else "down"),
        "pinch_api": pinch_status,
        "claude_api": claude_status,
        "database": db_status,
        "environment": settings.APP_ENV,
        "demo_mode": settings.DEMO_MODE,
        "version": "1.0.0",
        "uptime_seconds": int(time.time() - _start_time),
    }
