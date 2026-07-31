from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Text, ForeignKey, JSON, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Dishonour(Base):
    __tablename__ = "dishonours"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[int | None] = mapped_column(ForeignKey("payments.id"), nullable=True, index=True)
    payer_id: Mapped[int | None] = mapped_column(ForeignKey("payers.id"), nullable=True, index=True)
    reason_code: Mapped[str] = mapped_column(String(100))
    reason_label: Mapped[str] = mapped_column(String(200))
    action_taken: Mapped[str | None] = mapped_column(String(50), nullable=True)
    retry_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    claude_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_customer_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    claude_sms_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    reauth_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Prompt 3 — Smart retry timing
    retry_scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    retry_timing_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Prompt 4 — Payment plans
    plan_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    plan_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    plan_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Prompt 5 — Payment links
    payment_link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payment_link_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payment_link_status: Mapped[str] = mapped_column(String(20), default="sent")

    # Prompt 8 — Retry governance + idempotency
    retry_attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_retries_reached: Mapped[bool] = mapped_column(Boolean, default=False)
    nonce: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Internal notes
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    payment: Mapped["Payment"] = relationship("Payment", back_populates="dishonours")
    payer: Mapped["Payer"] = relationship("Payer", back_populates="dishonours")
