from datetime import datetime
from pydantic import BaseModel


class DishonourResponse(BaseModel):
    id: int
    payment_id: int | None
    payer_id: int | None
    reason_code: str
    reason_label: str
    action_taken: str | None
    retry_payment_id: str | None
    claude_explanation: str | None
    claude_customer_message: str | None
    status: str
    resolved_at: datetime | None
    created_at: datetime
    payer_name: str | None = None
    amount_cents: int | None = None
    recovery_probability: str | None = None

    model_config = {"from_attributes": True}
