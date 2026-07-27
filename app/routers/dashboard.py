from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.database import get_db
from app.models.payment import Payment
from app.models.dishonour import Dishonour
from app.models.payer import Payer
from app.services.claude_service import ClaudeService

router = APIRouter()
claude = ClaudeService()


def _next_business_day(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


class RecentActivity(BaseModel):
    payer_name: str
    amount_cents: int
    reason_label: str
    action_taken: str | None
    status: str
    created_at: datetime


class DashboardResponse(BaseModel):
    total_collected_cents: int
    total_at_risk_cents: int
    recovery_rate: float
    active_payers: int
    failed_today: int
    recovered_today: int
    agent_summary: str
    recent_activity: list[RecentActivity]
    projected_recovery_cents: int
    projected_recovery_date: str
    high_risk_payers: int


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    today_start = datetime.combine(date.today(), datetime.min.time())

    collected_result = await db.execute(
        select(func.sum(Payment.amount_cents)).where(Payment.status == "completed")
    )
    total_collected = collected_result.scalar() or 0

    at_risk_result = await db.execute(
        select(func.sum(Payment.amount_cents)).where(Payment.status == "failed")
    )
    total_at_risk = at_risk_result.scalar() or 0

    total_dishonours_result = await db.execute(select(func.count(Dishonour.id)))
    total_dishonours = total_dishonours_result.scalar() or 0

    resolved_dishonours_result = await db.execute(
        select(func.count(Dishonour.id)).where(Dishonour.status == "recovered")
    )
    resolved_dishonours = resolved_dishonours_result.scalar() or 0

    recovery_rate = (resolved_dishonours / total_dishonours * 100) if total_dishonours > 0 else 0.0

    active_payers_result = await db.execute(select(func.count(Payer.id)))
    active_payers = active_payers_result.scalar() or 0

    failed_today_result = await db.execute(
        select(func.count(Dishonour.id)).where(Dishonour.created_at >= today_start)
    )
    failed_today = failed_today_result.scalar() or 0

    recovered_today_result = await db.execute(
        select(func.count(Dishonour.id)).where(
            Dishonour.status == "recovered",
            Dishonour.resolved_at >= today_start,
        )
    )
    recovered_today = recovered_today_result.scalar() or 0

    # Projected recovery: sum of amounts in "retrying" status
    retrying_result = await db.execute(
        select(Dishonour, Payment)
        .outerjoin(Payment, Dishonour.payment_id == Payment.id)
        .where(Dishonour.status == "retrying")
    )
    retrying_rows = retrying_result.all()
    projected_recovery_cents = sum(
        (row[1].amount_cents if row[1] else 0) for row in retrying_rows
    )
    projected_recovery_date = _next_business_day(date.today(), 4).strftime("%-d %b %Y")

    # High risk payers: failures >= 2 in payment_history
    all_payers_result = await db.execute(select(Payer))
    all_payers = all_payers_result.scalars().all()
    high_risk_payers = sum(
        1 for p in all_payers
        if (p.payment_history or {}).get("failures", 0) >= 2
    )

    recent_result = await db.execute(
        select(Dishonour, Payer, Payment)
        .outerjoin(Payer, Dishonour.payer_id == Payer.id)
        .outerjoin(Payment, Dishonour.payment_id == Payment.id)
        .order_by(Dishonour.created_at.desc())
        .limit(10)
    )
    recent_rows = recent_result.all()

    recent_activity = []
    dishonour_dicts = []
    for row in recent_rows:
        dishonour, payer, payment = row
        recent_activity.append(RecentActivity(
            payer_name=payer.name if payer else "Unknown",
            amount_cents=payment.amount_cents if payment else 0,
            reason_label=dishonour.reason_label,
            action_taken=dishonour.action_taken,
            status=dishonour.status,
            created_at=dishonour.created_at,
        ))
        dishonour_dicts.append({
            "payer_name": payer.name if payer else "Unknown",
            "amount_cents": payment.amount_cents if payment else 0,
            "reason_label": dishonour.reason_label,
            "action_taken": dishonour.action_taken,
        })

    agent_summary = await claude.generate_agent_summary(dishonour_dicts)

    return DashboardResponse(
        total_collected_cents=total_collected,
        total_at_risk_cents=total_at_risk,
        recovery_rate=round(recovery_rate, 1),
        active_payers=active_payers,
        failed_today=failed_today,
        recovered_today=recovered_today,
        agent_summary=agent_summary,
        recent_activity=recent_activity,
        projected_recovery_cents=projected_recovery_cents,
        projected_recovery_date=projected_recovery_date,
        high_risk_payers=high_risk_payers,
    )
