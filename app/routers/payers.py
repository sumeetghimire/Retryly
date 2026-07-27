from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.payer import Payer
from app.models.dishonour import Dishonour

router = APIRouter()


class PayerItem(BaseModel):
    id: int
    pinch_payer_id: str
    name: str
    email: str
    phone: str | None
    total_payments: int
    failed_payments: int
    recovery_rate: float
    last_payment_date: datetime | None
    risk_score: str
    created_at: datetime


@router.get("/payers", response_model=list[PayerItem])
async def list_payers(db: AsyncSession = Depends(get_db)):
    payer_result = await db.execute(select(Payer).order_by(Payer.created_at.desc()))
    payers = payer_result.scalars().all()

    items = []
    for payer in payers:
        history = payer.payment_history or {}
        on_time = history.get("on_time", 0)
        failures = history.get("failures", 0)
        total = on_time + failures
        recovery_rate = (on_time / total * 100) if total > 0 else 100.0

        if failures >= 2:
            risk_score = "high"
        elif failures == 1:
            risk_score = "medium"
        else:
            risk_score = "low"

        dishonour_result = await db.execute(
            select(Dishonour).where(Dishonour.payer_id == payer.id)
            .order_by(Dishonour.created_at.desc())
            .limit(1)
        )
        latest = dishonour_result.scalar_one_or_none()

        items.append(PayerItem(
            id=payer.id,
            pinch_payer_id=payer.pinch_payer_id,
            name=payer.name,
            email=payer.email,
            phone=payer.phone,
            total_payments=total,
            failed_payments=failures,
            recovery_rate=round(recovery_rate, 1),
            last_payment_date=latest.created_at if latest else None,
            risk_score=risk_score,
            created_at=payer.created_at,
        ))

    return items
