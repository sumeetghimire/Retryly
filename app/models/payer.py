from datetime import datetime
from sqlalchemy import String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Payer(Base):
    __tablename__ = "payers"

    id: Mapped[int] = mapped_column(primary_key=True)
    pinch_payer_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_history: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    payment_sources: Mapped[list["PaymentSource"]] = relationship("PaymentSource", back_populates="payer")
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="payer")
    dishonours: Mapped[list["Dishonour"]] = relationship("Dishonour", back_populates="payer")
