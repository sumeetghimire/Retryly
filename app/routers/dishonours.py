from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.dishonour import Dishonour
from app.models.payer import Payer
from app.models.payment import Payment
from app.services.dishonour_classifier import DISHONOUR_MAP, DEFAULT_CLASSIFICATION
from app.services.pinch_service import PinchService, PinchAPIException

router = APIRouter()


class DishonourItem(BaseModel):
    id: int
    payer_name: str
    amount_cents: int
    reason_code: str
    reason_label: str
    action_taken: str | None
    claude_explanation: str | None
    claude_customer_message: str | None
    claude_sms_message: str | None
    reauth_link: str | None
    status: str
    recovery_probability: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DishonourListResponse(BaseModel):
    items: list[DishonourItem]
    total: int
    page: int


@router.get("/dishonours", response_model=DishonourListResponse)
async def list_dishonours(
    status: str = Query("all"),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
):
    page_size = 20
    offset = (page - 1) * page_size

    query = (
        select(Dishonour, Payer, Payment)
        .outerjoin(Payer, Dishonour.payer_id == Payer.id)
        .outerjoin(Payment, Dishonour.payment_id == Payment.id)
    )

    if status != "all":
        query = query.where(Dishonour.status == status)

    query = query.order_by(Dishonour.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    items = []
    for dishonour, payer, payment in rows:
        classification = DISHONOUR_MAP.get(dishonour.reason_code, DEFAULT_CLASSIFICATION)
        items.append(DishonourItem(
            id=dishonour.id,
            payer_name=payer.name if payer else "Unknown",
            amount_cents=payment.amount_cents if payment else 0,
            reason_code=dishonour.reason_code,
            reason_label=dishonour.reason_label,
            action_taken=dishonour.action_taken,
            claude_explanation=dishonour.claude_explanation,
            claude_customer_message=dishonour.claude_customer_message,
            claude_sms_message=dishonour.claude_sms_message,
            reauth_link=dishonour.reauth_link,
            status=dishonour.status,
            recovery_probability=classification.get("recovery_probability", "Low"),
            created_at=dishonour.created_at,
        ))

    from sqlalchemy import func
    count_query = select(func.count(Dishonour.id))
    if status != "all":
        count_query = count_query.where(Dishonour.status == status)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return DishonourListResponse(items=items, total=total, page=page)


@router.post("/dishonours/{dishonour_id}/approve-retry")
async def approve_retry(dishonour_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dishonour).where(Dishonour.id == dishonour_id))
    dishonour = result.scalar_one_or_none()
    if not dishonour:
        raise HTTPException(status_code=404, detail="Dishonour not found")

    payment_result = await db.execute(select(Payment).where(Payment.id == dishonour.payment_id))
    payment = payment_result.scalar_one_or_none()

    payer_result = await db.execute(select(Payer).where(Payer.id == dishonour.payer_id))
    payer = payer_result.scalar_one_or_none()

    if not payment or not payer:
        raise HTTPException(status_code=400, detail="Cannot retry: missing payment or payer data")

    try:
        async with PinchService() as pinch:
            retry = await pinch.retry_payment(
                payer_id=payer.pinch_payer_id,
                source_id="",
                amount_cents=payment.amount_cents,
                description="Manual retry approved",
            )
            dishonour.retry_payment_id = retry.get("id")
            dishonour.status = "retrying"
            dishonour.action_taken = "retry"
            await db.commit()
            return {"status": "retrying", "retry_payment_id": dishonour.retry_payment_id}
    except PinchAPIException as e:
        raise HTTPException(status_code=502, detail=f"Pinch API error: {e}")


@router.post("/dishonours/{dishonour_id}/send-message")
async def send_message(dishonour_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dishonour).where(Dishonour.id == dishonour_id))
    dishonour = result.scalar_one_or_none()
    if not dishonour:
        raise HTTPException(status_code=404, detail="Dishonour not found")
    dishonour.status = "message_sent"
    await db.commit()
    return {"status": "sent", "message": dishonour.claude_customer_message}


@router.post("/dishonours/{dishonour_id}/mark-resolved")
async def mark_resolved(dishonour_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dishonour).where(Dishonour.id == dishonour_id))
    dishonour = result.scalar_one_or_none()
    if not dishonour:
        raise HTTPException(status_code=404, detail="Dishonour not found")
    dishonour.status = "recovered"
    dishonour.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "recovered"}
