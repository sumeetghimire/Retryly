from sqlalchemy import String, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    auto_retry: Mapped[bool] = mapped_column(Boolean, default=True)
    retry_days: Mapped[int] = mapped_column(Integer, default=4)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    retry_cooldown_days: Mapped[int] = mapped_column(Integer, default=3)
    business_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sender_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notify_channel: Mapped[str] = mapped_column(String(20), default="email")

    user: Mapped["User"] = relationship("User", back_populates="settings")
