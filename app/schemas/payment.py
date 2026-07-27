from datetime import datetime
from pydantic import BaseModel


class PaymentResponse(BaseModel):
    id: int
    payer_id: int
    pinch_payment_id: str
    amount_cents: int
    status: str
    scheduled_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
