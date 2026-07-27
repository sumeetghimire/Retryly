import secrets
from datetime import datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)

SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        path="/",
    )


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = await db.execute(
        select(Session).where(
            Session.token == token,
            Session.expires_at > datetime.utcnow(),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def _create_session(user_id: int, db: AsyncSession) -> str:
    token = secrets.token_hex(32)
    session = Session(
        user_id=user_id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(seconds=SESSION_MAX_AGE),
    )
    db.add(session)
    await db.commit()
    return token


class RegisterRequest(BaseModel):
    business_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    business_name: str
    onboarding_complete: bool


@router.post("/register")
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        business_name=body.business_name,
        email=body.email,
        password_hash=_hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    token = await _create_session(user.id, db)
    _set_session_cookie(response, token)
    return {"user": UserOut(id=user.id, email=user.email, business_name=user.business_name, onboarding_complete=user.onboarding_complete)}


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not _check_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await _create_session(user.id, db)
    _set_session_cookie(response, token)
    return {"user": UserOut(id=user.id, email=user.email, business_name=user.business_name, onboarding_complete=user.onboarding_complete)}


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("session_token")
    if token:
        result = await db.execute(select(Session).where(Session.token == token))
        session = result.scalar_one_or_none()
        if session:
            await db.delete(session)
            await db.commit()
    response.delete_cookie("session_token")
    return {"message": "logged out"}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"user": UserOut(id=user.id, email=user.email, business_name=user.business_name, onboarding_complete=user.onboarding_complete)}
