from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PaymentSource(Base):
    __tablename__ = "payment_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    payer_id: Mapped[int] = mapped_column(ForeignKey("payers.id"), index=True)
    pinch_source_id: Mapped[str] = mapped_column(String(100), unique=True)
    bsb: Mapped[str | None] = mapped_column(String(10), nullable=True)
    account_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    payer: Mapped["Payer"] = relationship("Payer", back_populates="payment_sources")
