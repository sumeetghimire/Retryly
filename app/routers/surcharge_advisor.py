from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.payer import Payer
from app.models.payment import Payment
from app.services.claude_service import ClaudeService

router = APIRouter(prefix="/api", tags=["Surcharge Advisor"])
claude = ClaudeService()

BAN_DATE = date(2026, 10, 1)


def _calc_becs_fee(amount_cents: int) -> int:
    return min(int(amount_cents * 0.01) + 30, 500)


def _calc_card_fee(amount_cents: int) -> int:
    return int(amount_cents * 0.0195) + 30


@router.get("/surcharge-advisor")
async def get_surcharge_advisor(db: AsyncSession = Depends(get_db)):
    days_until_ban = max(0, (BAN_DATE - date.today()).days)

    payer_result = await db.execute(select(Payer))
    payers = payer_result.scalars().all()

    total_card_fees = 0
    total_dd_fees = 0
    payers_on_card = 0
    payers_on_dd = 0
    payer_breakdown = []

    for payer in payers:
        # Get average payment amount
        payment_result = await db.execute(
            select(Payment).where(Payment.payer_id == payer.id).limit(10)
        )
        payments = payment_result.scalars().all()
        if not payments:
            continue

        avg_amount = sum(p.amount_cents for p in payments) // len(payments)
        history = payer.payment_history or {}

        # Simulate: payers with 0 failures = probably card (optimistic assumption for demo)
        # In production, check payment source type
        is_card = history.get("payment_type", "card") == "card" or history.get("failures", 0) == 0

        card_fee = _calc_card_fee(avg_amount)
        dd_fee = _calc_becs_fee(avg_amount)
        saving = card_fee - dd_fee

        if is_card:
            payers_on_card += 1
            total_card_fees += card_fee
            total_dd_fees += dd_fee
        else:
            payers_on_dd += 1

        payer_breakdown.append({
            "payer_name": payer.name,
            "avg_payment_cents": avg_amount,
            "card_fee_cents": card_fee,
            "dd_fee_cents": dd_fee,
            "monthly_saving_cents": max(0, saving),
            "is_card": is_card,
        })

    monthly_saving = total_card_fees - total_dd_fees
    annual_saving = monthly_saving * 12

    claude_insight = await claude.generate_surcharge_insight(
        payers_on_card=payers_on_card,
        monthly_amount=total_card_fees / 100,
    )

    payer_breakdown_sorted = sorted(
        [p for p in payer_breakdown if p["is_card"]],
        key=lambda x: x["monthly_saving_cents"],
        reverse=True,
    )

    return {
        "days_until_ban": days_until_ban,
        "ban_date": BAN_DATE.isoformat(),
        "total_monthly_card_fees_cents": total_card_fees,
        "total_monthly_dd_fees_cents": total_dd_fees,
        "monthly_saving_cents": max(0, monthly_saving),
        "annual_saving_cents": max(0, annual_saving),
        "payers_on_card": payers_on_card,
        "payers_on_dd": payers_on_dd,
        "claude_insight": claude_insight,
        "payer_breakdown": payer_breakdown_sorted[:20],
    }
