from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    pinch_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Managed Merchant fields
    pinch_merchant_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pinch_merchant_status: Mapped[str] = mapped_column(String(20), default="pending")
    onboarding_type: Mapped[str] = mapped_column(String(20), default="managed")

    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="user")
    settings: Mapped["UserSettings | None"] = relationship("UserSettings", back_populates="user", uselist=False)
