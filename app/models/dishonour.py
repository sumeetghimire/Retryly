from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey
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

    payment: Mapped["Payment"] = relationship("Payment", back_populates="dishonours")
    payer: Mapped["Payer"] = relationship("Payer", back_populates="dishonours")
