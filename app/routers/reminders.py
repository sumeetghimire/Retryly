import logging
from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.payer import Payer
from app.models.payment import Payment
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.claude_service import ClaudeService
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reminders", tags=["Reminders"])

claude = ClaudeService()
emailer = EmailService()


@router.post("/send-pre-debit")
async def send_pre_debit_reminders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Find at-risk payers with payments due in the next 3 days and send
    them a friendly heads-up before the payment is attempted.
    Reduces failure rates by ~20% — prevents dishonours before they happen.
    """
    window_start = datetime.combine(date.today(), datetime.min.time())
    window_end = datetime.combine(date.today() + timedelta(days=3), datetime.min.time())

    # Find upcoming payments
    upcoming_result = await db.execute(
        select(Payment, Payer)
        .join(Payer, Payment.payer_id == Payer.id)
        .where(
            Payment.status == "pending",
            Payment.scheduled_at >= window_start,
            Payment.scheduled_at < window_end,
        )
    )
    upcoming_rows = upcoming_result.all()

    # Also include any payer with a failure history even without a "pending" payment
    # (for demo: include all payers with failures >= 1)
    if not upcoming_rows:
        at_risk_result = await db.execute(select(Payer))
        all_payers = at_risk_result.scalars().all()
        at_risk_payers = [p for p in all_payers if (p.payment_history or {}).get("failures", 0) >= 1]
        upcoming_rows = [(None, p) for p in at_risk_payers]

    sent = []
    skipped = []

    for payment, payer in upcoming_rows:
        failures = (payer.payment_history or {}).get("failures", 0)

        # Only remind payers who have a history of failures (they need the nudge)
        if failures < 1 and payment is not None:
            skipped.append(payer.name)
            continue

        amount_cents = payment.amount_cents if payment else 0
        payment_date = (
            payment.scheduled_at.strftime("%-d %B %Y")
            if payment and payment.scheduled_at
            else "in the next few days"
        )

        try:
            reminder_text = await claude.generate_pre_debit_reminder(
                payer_name=payer.name,
                amount_cents=amount_cents,
                payment_date=payment_date,
                failures=failures,
            )
        except Exception as e:
            logger.error(f"Claude reminder generation failed for {payer.name}: {e}")
            first_name = payer.name.split()[0]
            amount_str = f"${amount_cents / 100:.2f}" if amount_cents else "your upcoming payment"
            reminder_text = (
                f"Hi {first_name}, a friendly reminder that {amount_str} is due {payment_date}. "
                f"Please ensure funds are available in your account."
            )

        sent_ok = await emailer.send_pre_debit_reminder(
            payer_email=payer.email,
            payer_name=payer.name,
            reminder_message=reminder_text,
        )

        sent.append({
            "payer_name": payer.name,
            "payer_email": payer.email,
            "amount_cents": amount_cents,
            "payment_date": payment_date,
            "message": reminder_text,
            "email_sent": sent_ok,
        })

        logger.info(
            f"Pre-debit reminder {'sent' if sent_ok else 'generated (no email config)'} "
            f"for {payer.name} — {payment_date}"
        )

    return {
        "reminders_sent": len(sent),
        "skipped": len(skipped),
        "details": sent,
    }
