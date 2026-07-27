from datetime import datetime
from pydantic import BaseModel, EmailStr


class PayerBase(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None


class PayerCreate(PayerBase):
    pinch_payer_id: str


class PayerResponse(PayerBase):
    id: int
    pinch_payer_id: str
    payment_history: dict
    created_at: datetime
    total_payments: int = 0
    failed_payments: int = 0
    recovery_rate: float = 0.0
    last_payment_date: datetime | None = None
    risk_score: str = "low"

    model_config = {"from_attributes": True}
