from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.payer import Payer
from app.models.payment import Payment
from app.services.risk_scorer import RiskScorer

router = APIRouter(prefix="/api", tags=["Risk"])
scorer = RiskScorer()


@router.get("/risk-report")
async def get_risk_report(db: AsyncSession = Depends(get_db)):
    payer_result = await db.execute(select(Payer))
    payers = payer_result.scalars().all()

    report = []
    for payer in payers:
        # Get upcoming payment
        payment_result = await db.execute(
            select(Payment)
            .where(Payment.payer_id == payer.id, Payment.status == "scheduled")
            .order_by(Payment.scheduled_at)
            .limit(1)
        )
        upcoming = payment_result.scalar_one_or_none()
        risk = scorer.calculate_risk_score(payer, upcoming)

        if risk["risk_level"] in ("high", "medium"):
            report.append({
                "payer_id": payer.id,
                "payer_name": payer.name,
                "amount": upcoming.amount_cents if upcoming else 0,
                "scheduled_date": upcoming.scheduled_at.isoformat() if upcoming and upcoming.scheduled_at else None,
                "risk_level": risk["risk_level"],
                "risk_score": risk["score"],
                "risk_factors": risk["factors"],
                "recommendation": risk["recommendation"],
            })

    return sorted(report, key=lambda x: x["risk_score"], reverse=True)
