from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.database import get_db
from app.models.dishonour import Dishonour
from app.models.payer import Payer
from app.models.payment import Payment
from app.models.payment_source import PaymentSource
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
    # Prompt 3
    retry_scheduled_date: str | None = None
    retry_timing_reason: str | None = None
    # Prompt 4
    plan_options: dict | None = None
    plan_id: str | None = None
    plan_accepted_at: datetime | None = None
    # Prompt 5
    payment_link_url: str | None = None
    payment_link_expires_at: datetime | None = None
    payment_link_status: str = "sent"
    # Prompt 8
    retry_attempt_count: int = 0
    max_retries_reached: bool = False

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
            retry_scheduled_date=dishonour.retry_scheduled_date.isoformat() if dishonour.retry_scheduled_date else None,
            retry_timing_reason=dishonour.retry_timing_reason,
            plan_options=dishonour.plan_options,
            plan_id=dishonour.plan_id,
            plan_accepted_at=dishonour.plan_accepted_at,
            payment_link_url=dishonour.payment_link_url,
            payment_link_expires_at=dishonour.payment_link_expires_at,
            payment_link_status=dishonour.payment_link_status or "sent",
            retry_attempt_count=dishonour.retry_attempt_count or 0,
            max_retries_reached=dishonour.max_retries_reached or False,
        ))

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

    from app.tasks.process_dishonours import can_retry
    ok, reason = can_retry(dishonour)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    payment_result = await db.execute(select(Payment).where(Payment.id == dishonour.payment_id))
    payment = payment_result.scalar_one_or_none()
    payer_result = await db.execute(select(Payer).where(Payer.id == dishonour.payer_id))
    payer = payer_result.scalar_one_or_none()

    if not payment or not payer:
        raise HTTPException(status_code=400, detail="Cannot retry: missing payment or payer data")

    from app.services.retry_scheduler import RetryScheduler
    from datetime import date
    sched = RetryScheduler()
    retry_date, timing_reason = sched.calculate_optimal_retry_date(dishonour.reason_code, payer, date.today())

    try:
        async with PinchService() as pinch:
            attempt_num = (dishonour.retry_attempt_count or 0) + 1
            nonce = f"retryly-{dishonour.id}-attempt-{attempt_num}"
            retry = await pinch.schedule_payment(
                payer_id=payer.pinch_payer_id,
                source_id="",
                amount_cents=payment.amount_cents,
                scheduled_date=retry_date.isoformat(),
                description=f"[RETRY] Manual retry approved",
                reference=nonce,
            )
            dishonour.retry_payment_id = retry.get("id")
            dishonour.status = "retrying"
            dishonour.action_taken = "retry"
            dishonour.retry_attempt_count = attempt_num
            dishonour.last_retry_at = datetime.utcnow()
            dishonour.retry_scheduled_date = retry_date
            dishonour.retry_timing_reason = timing_reason
            dishonour.nonce = nonce
            await db.commit()
            return {"status": "retrying", "retry_payment_id": dishonour.retry_payment_id, "retry_date": retry_date.isoformat()}
    except PinchAPIException as e:
        raise HTTPException(status_code=502, detail=f"Pinch API error: {e}")


@router.post("/dishonours/{dishonour_id}/accept-plan")
async def accept_plan(dishonour_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dishonour).where(Dishonour.id == dishonour_id))
    dishonour = result.scalar_one_or_none()
    if not dishonour:
        raise HTTPException(status_code=404, detail="Dishonour not found")

    plan_option_idx = body.get("plan_option", 2) - 1  # 1-indexed to 0-indexed
    plan_options = dishonour.plan_options or {}
    options = plan_options.get("options", [])

    if plan_option_idx < 0 or plan_option_idx >= len(options):
        # Use defaults
        option = {"num_payments": 3, "frequency": "fortnightly"}
    else:
        option = options[plan_option_idx]

    payer_result = await db.execute(select(Payer).where(Payer.id == dishonour.payer_id))
    payer = payer_result.scalar_one_or_none()
    payment_result = await db.execute(select(Payment).where(Payment.id == dishonour.payment_id))
    payment = payment_result.scalar_one_or_none()

    if not payer:
        raise HTTPException(status_code=400, detail="Payer not found")

    amount_cents = payment.amount_cents if payment else 0
    source_result = await db.execute(
        select(PaymentSource).where(PaymentSource.payer_id == payer.id).limit(1)
    )
    source = source_result.scalar_one_or_none()
    source_id = source.pinch_source_id if source else ""

    try:
        async with PinchService() as pinch:
            plan = await pinch.create_payment_plan(
                payer_id=payer.pinch_payer_id,
                source_id=source_id,
                total_amount_cents=amount_cents,
                num_payments=option.get("num_payments", 3),
                frequency=option.get("frequency", "fortnightly"),
            )
            plan_id = plan.get("id") or plan.get("data", {}).get("id", "")
            dishonour.plan_id = str(plan_id)
            dishonour.plan_accepted_at = datetime.utcnow()
            dishonour.status = "plan_active"
            await db.commit()
            return {"status": "plan_active", "plan_id": plan_id, "option": option}
    except PinchAPIException as e:
        raise HTTPException(status_code=502, detail=f"Pinch API error: {e}")


@router.post("/dishonours/{dishonour_id}/resend-link")
async def resend_payment_link(dishonour_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dishonour).where(Dishonour.id == dishonour_id))
    dishonour = result.scalar_one_or_none()
    if not dishonour:
        raise HTTPException(status_code=404, detail="Dishonour not found")

    payer_result = await db.execute(select(Payer).where(Payer.id == dishonour.payer_id))
    payer = payer_result.scalar_one_or_none()
    payment_result = await db.execute(select(Payment).where(Payment.id == dishonour.payment_id))
    payment = payment_result.scalar_one_or_none()

    if not payer:
        raise HTTPException(status_code=400, detail="Payer not found")

    amount_cents = payment.amount_cents if payment else 0

    try:
        async with PinchService() as pinch:
            link_data = await pinch.create_payment_link(
                payer_id=payer.pinch_payer_id,
                amount_cents=amount_cents,
                description="Update payment details",
                expires_in_days=7,
                reference=str(dishonour.id),
            )
            url = link_data.get("url") or link_data.get("link") or link_data.get("data", {}).get("url")
            expires_at = datetime.utcnow() + timedelta(days=7)
            dishonour.payment_link_url = url
            dishonour.reauth_link = url
            dishonour.payment_link_expires_at = expires_at
            dishonour.payment_link_status = "sent"
            await db.commit()
            return {"url": url, "expires_at": expires_at.isoformat()}
    except PinchAPIException as e:
        raise HTTPException(status_code=502, detail=f"Pinch API error: {e}")


@router.get("/dishonours/{dishonour_id}/audit-log")
async def get_audit_log(dishonour_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dishonour).where(Dishonour.id == dishonour_id))
    dishonour = result.scalar_one_or_none()
    if not dishonour:
        raise HTTPException(status_code=404, detail="Dishonour not found")

    log = [{"timestamp": dishonour.created_at.isoformat(), "action": "classified", "reason": dishonour.reason_code, "outcome": dishonour.action_taken or "unknown", "retry_attempt_number": 0}]
    if dishonour.last_retry_at:
        log.append({"timestamp": dishonour.last_retry_at.isoformat(), "action": "retry_scheduled", "reason": dishonour.retry_timing_reason or "", "outcome": "retrying", "retry_attempt_number": dishonour.retry_attempt_count or 1})
    if dishonour.plan_accepted_at:
        log.append({"timestamp": dishonour.plan_accepted_at.isoformat(), "action": "plan_accepted", "reason": "Customer accepted payment plan", "outcome": "plan_active", "retry_attempt_number": 0})
    if dishonour.resolved_at:
        log.append({"timestamp": dishonour.resolved_at.isoformat(), "action": "resolved", "reason": "Payment recovered", "outcome": "recovered", "retry_attempt_number": 0})

    return {"dishonour_id": dishonour_id, "log": sorted(log, key=lambda x: x["timestamp"])}


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


@router.post("/dishonours/{dishonour_id}/write-off")
async def write_off(dishonour_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dishonour).where(Dishonour.id == dishonour_id))
    dishonour = result.scalar_one_or_none()
    if not dishonour:
        raise HTTPException(status_code=404, detail="Dishonour not found")
    dishonour.status = "written_off"
    dishonour.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "written_off"}
