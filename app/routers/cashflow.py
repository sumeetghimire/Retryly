import time
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.payer import Payer
from app.models.payment import Payment
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.cashflow_forecaster import CashFlowForecaster
from app.services.risk_scorer import RiskScorer
from app.services.claude_service import ClaudeService
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Cashflow"])

CACHE_TTL = 900  # 15 minutes

# In-process cache: user_id -> (timestamp, forecast_dict)
_forecast_cache: dict[int, tuple[float, dict]] = {}

# Track payer_ids that have received pre-debit reminders (resets on server restart — fine for demo)
_sent_reminders: set[int] = set()

_forecaster = CashFlowForecaster()
_risk_scorer = RiskScorer()
_claude = ClaudeService()
_emailer = EmailService()


async def _build_forecast(user_id: int, db: AsyncSession, force: bool = False) -> dict:
    now = time.time()
    if not force and user_id in _forecast_cache:
        cached_at, cached_data = _forecast_cache[user_id]
        if now - cached_at < CACHE_TTL:
            return cached_data

    data = await _forecaster.generate_forecast(db, _risk_scorer, _sent_reminders)
    summary = data["summary"]

    try:
        insight = await _claude.generate_cashflow_insight(
            best_case_cents=summary["best_case_cents"],
            worst_case_cents=summary["worst_case_cents"],
            at_risk_cents=summary["at_risk_total_cents"],
            retryly_recovers_cents=summary["retryly_recovers_cents"],
            biggest_risk_date=summary.get("biggest_risk_date") or "No high-risk days identified",
            biggest_risk_payers=summary.get("biggest_risk_payers", []),
            high_risk_count=summary["high_risk_count"],
        )
    except Exception as e:
        logger.error(f"Cashflow insight generation failed: {e}")
        at_risk = summary["at_risk_total_cents"] / 100
        high = summary["high_risk_count"]
        insight = (
            f"${at_risk:,.2f} is at risk over the next 14 days. "
            f"Retryly is monitoring {high} high-risk payment{'s' if high != 1 else ''} "
            f"and will act automatically if any fail."
        )

    data["claude_insight"] = insight
    _forecast_cache[user_id] = (now, data)
    return data


# ── GET /api/cashflow/forecast ─────────────────────────────────────────────────

@router.get("/api/cashflow/forecast")
async def get_forecast(
    response: Response,
    force: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "max-age=900"
    return await _build_forecast(user.id, db, force=force)


# ── GET /api/cashflow/summary ──────────────────────────────────────────────────

@router.get("/api/cashflow/summary")
async def get_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await _build_forecast(user.id, db)
    summary = data["summary"]
    return {
        "best_case_cents": summary["best_case_cents"],
        "worst_case_cents": summary["worst_case_cents"],
        "at_risk_total_cents": summary["at_risk_total_cents"],
        "retryly_recovers_cents": summary["retryly_recovers_cents"],
        "biggest_risk_date": summary.get("biggest_risk_date"),
        "biggest_risk_amount_cents": summary.get("biggest_risk_amount_cents", 0),
        "claude_insight": data.get("claude_insight", ""),
        "high_risk_count": summary["high_risk_count"],
        # First 7 days for dashboard mini chart
        "daily_forecast": data.get("daily_forecast", [])[:7],
    }


# ── POST /api/cashflow/send-reminder/{payer_id} ────────────────────────────────

@router.post("/api/cashflow/send-reminder/{payer_id}")
async def send_reminder(
    payer_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payer_result = await db.execute(select(Payer).where(Payer.id == payer_id))
    payer = payer_result.scalar_one_or_none()
    if not payer:
        raise HTTPException(status_code=404, detail="Payer not found")

    # Find their next upcoming payment
    tomorrow = datetime.combine(date.today(), datetime.min.time())
    payment_result = await db.execute(
        select(Payment)
        .where(
            and_(
                Payment.payer_id == payer_id,
                Payment.status.in_(["scheduled", "pending"]),
                Payment.scheduled_at >= tomorrow,
            )
        )
        .order_by(Payment.scheduled_at)
        .limit(1)
    )
    payment = payment_result.scalar_one_or_none()

    failures = (payer.payment_history or {}).get("failures", 0)
    amount_cents = payment.amount_cents if payment else 0
    payment_date = (
        payment.scheduled_at.strftime("%-d %B %Y")
        if payment and payment.scheduled_at
        else "in the next few days"
    )

    try:
        reminder_text = await _claude.generate_pre_debit_reminder(
            payer_name=payer.name,
            amount_cents=amount_cents,
            payment_date=payment_date,
            failures=failures,
        )
    except Exception as e:
        logger.error(f"Claude pre-debit reminder failed for payer {payer_id}: {e}")
        first_name = payer.name.split()[0]
        amount_str = f"${amount_cents / 100:.2f}" if amount_cents else "your upcoming payment"
        reminder_text = (
            f"Hi {first_name}, a friendly reminder that {amount_str} is due {payment_date}. "
            f"Please ensure your account has sufficient funds."
        )

    email_sent = await _emailer.send_pre_debit_reminder(
        payer_email=payer.email,
        payer_name=payer.name,
        reminder_message=reminder_text,
    )

    _sent_reminders.add(payer_id)
    # Bust cache so next forecast shows updated reminder_sent flags
    _forecast_cache.pop(user.id, None)

    preview = reminder_text[:200] + "…" if len(reminder_text) > 200 else reminder_text
    return {
        "sent": True,
        "email_sent": email_sent,
        "message_preview": preview,
    }
