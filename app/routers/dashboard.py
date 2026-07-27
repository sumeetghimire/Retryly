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


class MonthlyTrend(BaseModel):
    month: str
    recovered: int
    failed: int


class SurchargeBanImpact(BaseModel):
    days_until_ban: int
    message: str


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
    # Prompt 6 additions
    recovered_this_month_cents: int = 0
    at_risk_cents: int = 0
    recovery_rate_percent: float = 0.0
    avg_days_to_recover: float = 0.0
    top_dishonour_reason: str = ""
    total_retries_this_month: int = 0
    successful_retries: int = 0
    payment_links_sent: int = 0
    payment_links_paid: int = 0
    plans_active: int = 0
    plans_total_value_cents: int = 0
    without_retryly_loss_cents: int = 0
    retryly_saved_cents: int = 0
    monthly_trend: list[MonthlyTrend] = []
    surcharge_ban_impact: SurchargeBanImpact | None = None


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

    # --- Prompt 6: Extended analytics ---
    month_start = datetime.combine(date.today().replace(day=1), datetime.min.time())

    recovered_month_result = await db.execute(
        select(func.sum(Payment.amount_cents))
        .join(Dishonour, Dishonour.payment_id == Payment.id)
        .where(Dishonour.status == "recovered", Dishonour.resolved_at >= month_start)
    )
    recovered_this_month_cents = recovered_month_result.scalar() or 0

    retrying_sum_result = await db.execute(
        select(func.sum(Payment.amount_cents))
        .join(Dishonour, Dishonour.payment_id == Payment.id)
        .where(Dishonour.status == "retrying")
    )
    at_risk_cents = retrying_sum_result.scalar() or 0

    retries_month_result = await db.execute(
        select(func.count(Dishonour.id)).where(
            Dishonour.action_taken == "retry",
            Dishonour.created_at >= month_start,
        )
    )
    total_retries_this_month = retries_month_result.scalar() or 0

    successful_retries_result = await db.execute(
        select(func.count(Dishonour.id)).where(
            Dishonour.action_taken == "retry",
            Dishonour.status == "recovered",
            Dishonour.created_at >= month_start,
        )
    )
    successful_retries = successful_retries_result.scalar() or 0

    links_sent_result = await db.execute(
        select(func.count(Dishonour.id)).where(Dishonour.payment_link_url.isnot(None))
    )
    payment_links_sent = links_sent_result.scalar() or 0

    links_paid_result = await db.execute(
        select(func.count(Dishonour.id)).where(Dishonour.payment_link_status == "paid")
    )
    payment_links_paid = links_paid_result.scalar() or 0

    plans_result = await db.execute(
        select(func.count(Dishonour.id)).where(Dishonour.status == "plan_active")
    )
    plans_active = plans_result.scalar() or 0

    plans_value_result = await db.execute(
        select(func.sum(Payment.amount_cents))
        .join(Dishonour, Dishonour.payment_id == Payment.id)
        .where(Dishonour.status == "plan_active")
    )
    plans_total_value_cents = plans_value_result.scalar() or 0

    # Recovery impact: AU SMB 63% failure rate estimate
    total_payments_cents = total_collected + total_at_risk
    without_retryly_loss_cents = int(total_payments_cents * 0.63)
    retryly_saved_cents = recovered_this_month_cents

    # Average days to recover
    recovered_result = await db.execute(
        select(Dishonour).where(Dishonour.status == "recovered", Dishonour.resolved_at.isnot(None))
    )
    recovered_all = recovered_result.scalars().all()
    avg_days = 0.0
    if recovered_all:
        days_list = [
            (d.resolved_at - d.created_at).days for d in recovered_all
            if d.resolved_at and d.created_at
        ]
        avg_days = round(sum(days_list) / len(days_list), 1) if days_list else 0.0

    # Top dishonour reason
    top_reason_result = await db.execute(
        select(Dishonour.reason_label, func.count(Dishonour.id).label("cnt"))
        .group_by(Dishonour.reason_label)
        .order_by(func.count(Dishonour.id).desc())
        .limit(1)
    )
    top_reason_row = top_reason_result.first()
    top_dishonour_reason = top_reason_row[0] if top_reason_row else ""

    # Monthly trend (last 6 months)
    monthly_trend = []
    for i in range(5, -1, -1):
        m_start = (date.today().replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        m_end = (m_start + timedelta(days=32)).replace(day=1)
        m_start_dt = datetime.combine(m_start, datetime.min.time())
        m_end_dt = datetime.combine(m_end, datetime.min.time())

        m_recovered = await db.execute(
            select(func.sum(Payment.amount_cents))
            .join(Dishonour, Dishonour.payment_id == Payment.id)
            .where(Dishonour.status == "recovered", Dishonour.resolved_at >= m_start_dt, Dishonour.resolved_at < m_end_dt)
        )
        m_failed = await db.execute(
            select(func.sum(Payment.amount_cents))
            .join(Dishonour, Dishonour.payment_id == Payment.id)
            .where(Dishonour.created_at >= m_start_dt, Dishonour.created_at < m_end_dt)
        )
        monthly_trend.append(MonthlyTrend(
            month=m_start.strftime("%b"),
            recovered=m_recovered.scalar() or 0,
            failed=m_failed.scalar() or 0,
        ))

    # Surcharge ban countdown
    ban_date = date(2026, 10, 1)
    days_until_ban = (ban_date - date.today()).days
    surcharge_ban_impact = SurchargeBanImpact(
        days_until_ban=max(0, days_until_ban),
        message=f"Card surcharging banned in {max(0, days_until_ban)} days (1 Oct 2026) — switch to direct debit now.",
    )

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
        recovered_this_month_cents=recovered_this_month_cents,
        at_risk_cents=at_risk_cents,
        recovery_rate_percent=round(recovery_rate, 1),
        avg_days_to_recover=avg_days,
        top_dishonour_reason=top_dishonour_reason,
        total_retries_this_month=total_retries_this_month,
        successful_retries=successful_retries,
        payment_links_sent=payment_links_sent,
        payment_links_paid=payment_links_paid,
        plans_active=plans_active,
        plans_total_value_cents=plans_total_value_cents,
        without_retryly_loss_cents=without_retryly_loss_cents,
        retryly_saved_cents=retryly_saved_cents,
        monthly_trend=monthly_trend,
        surcharge_ban_impact=surcharge_ban_impact,
    )
