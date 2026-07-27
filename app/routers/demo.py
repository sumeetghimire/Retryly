import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.config import settings
from app.models.payer import Payer
from app.models.payment import Payment
from app.models.dishonour import Dishonour
from app.models.payment_source import PaymentSource
from app.services.pinch_service import PinchService
from app.tasks.process_dishonours import process_dishonours

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_demo():
    if not settings.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Demo mode is disabled")


MOCK_MIXED_PAYLOAD = {
    "event": "bank-results",
    "data": {
        "failedPayments": [
            {
                "paymentId": "DEMO-PAY-001",
                "payerName": "Sarah Chen",
                "dishonourCode": "insufficient-funds",
                "amount": 50000,
                "description": "Monthly subscription",
                "paymentSourceId": "SRC-001",
            },
            {
                "paymentId": "DEMO-PAY-002",
                "payerName": "James Brown",
                "dishonourCode": "insufficient-funds",
                "amount": 80000,
                "description": "Monthly invoice",
                "paymentSourceId": "SRC-002",
            },
            {
                "paymentId": "DEMO-PAY-003",
                "payerName": "Mike Torres",
                "dishonourCode": "refer-to-payer",
                "amount": 35000,
                "description": "Service fee",
                "paymentSourceId": "SRC-003",
            },
            {
                "paymentId": "DEMO-PAY-004",
                "payerName": "Lisa Park",
                "dishonourCode": "account-closed",
                "amount": 120000,
                "description": "Annual plan payment",
                "paymentSourceId": "SRC-004",
            },
            {
                "paymentId": "DEMO-PAY-005",
                "payerName": "Unknown Payer",
                "dishonourCode": "payment-stopped",
                "amount": 65000,
                "description": "One-off payment",
                "paymentSourceId": "SRC-005",
            },
        ]
    },
}

MOCK_NSF_PAYLOAD = {
    "event": "bank-results",
    "data": {
        "failedPayments": [
            {
                "paymentId": "DEMO-NSF-001",
                "payerName": "Sarah Chen",
                "dishonourCode": "insufficient-funds",
                "amount": 50000,
                "description": "Monthly subscription",
            }
        ]
    },
}

MOCK_CLOSED_PAYLOAD = {
    "event": "bank-results",
    "data": {
        "failedPayments": [
            {
                "paymentId": "DEMO-CLOSED-001",
                "payerName": "Lisa Park",
                "dishonourCode": "account-closed",
                "amount": 120000,
                "description": "Annual plan payment",
            }
        ]
    },
}


async def _ensure_demo_payers(db: AsyncSession):
    """Create demo payers in DB if they don't exist."""
    demo_payers = [
        {"pinch_payer_id": "DEMO-PAYER-001", "name": "Sarah Chen",
         "email": "sarah.chen@example.com", "payment_history": {"on_time": 12, "failures": 0}},
        {"pinch_payer_id": "DEMO-PAYER-002", "name": "James Brown",
         "email": "james.brown@example.com", "payment_history": {"on_time": 6, "failures": 3}},
        {"pinch_payer_id": "DEMO-PAYER-003", "name": "Mike Torres",
         "email": "mike.torres@example.com", "payment_history": {"on_time": 1, "failures": 0}},
        {"pinch_payer_id": "DEMO-PAYER-004", "name": "Lisa Park",
         "email": "lisa.park@example.com", "payment_history": {"on_time": 8, "failures": 1}},
    ]
    payer_map = {}
    for pd in demo_payers:
        result = await db.execute(select(Payer).where(Payer.pinch_payer_id == pd["pinch_payer_id"]))
        payer = result.scalar_one_or_none()
        if not payer:
            payer = Payer(**pd)
            db.add(payer)
            await db.flush()
        payer_map[pd["name"]] = payer

    payment_defs = [
        ("DEMO-PAY-001", "Sarah Chen", 50000),
        ("DEMO-PAY-002", "James Brown", 80000),
        ("DEMO-PAY-003", "Mike Torres", 35000),
        ("DEMO-PAY-004", "Lisa Park", 120000),
    ]
    for pid, pname, amount in payment_defs:
        result = await db.execute(select(Payment).where(Payment.pinch_payment_id == pid))
        payment = result.scalar_one_or_none()
        if not payment and pname in payer_map:
            payment = Payment(
                payer_id=payer_map[pname].id,
                pinch_payment_id=pid,
                amount_cents=amount,
                status="failed",
                scheduled_at=datetime.utcnow(),
            )
            db.add(payment)

    await db.commit()


@router.post("/demo/seed")
async def demo_seed(db: AsyncSession = Depends(get_db)):
    _require_demo()
    try:
        async with PinchService() as pinch:
            results = await pinch.seed_test_data()

        for r in results:
            if "error" in r:
                continue
            payer_data = r.get("payer", {})
            payer_id = payer_data.get("id") or payer_data.get("data", {}).get("id")
            payer_name_parts = [
                payer_data.get("firstName", ""), payer_data.get("lastName", "")
            ]
            payer_name = " ".join(p for p in payer_name_parts if p).strip() or "Unknown"

            existing = await db.execute(select(Payer).where(Payer.pinch_payer_id == str(payer_id)))
            if not existing.scalar_one_or_none():
                db_payer = Payer(
                    pinch_payer_id=str(payer_id),
                    name=payer_name,
                    email=payer_data.get("email", ""),
                    phone=payer_data.get("phone"),
                    payment_history=r.get("payment_history", {}),
                )
                db.add(db_payer)

        await db.commit()
        return {"status": "seeded", "count": len(results), "results": results}
    except Exception as e:
        logger.error(f"Demo seed failed: {e}")
        await _ensure_demo_payers(db)
        return {"status": "seeded_local", "message": "Used local demo data (Pinch API unavailable)"}


@router.post("/demo/trigger/{trigger_type}")
async def demo_trigger(trigger_type: str, db: AsyncSession = Depends(get_db)):
    _require_demo()

    payload_map = {
        "insufficient-funds": MOCK_NSF_PAYLOAD,
        "account-closed": MOCK_CLOSED_PAYLOAD,
        "mixed": MOCK_MIXED_PAYLOAD,
    }

    payload = payload_map.get(trigger_type)
    if not payload:
        raise HTTPException(status_code=400, detail=f"Unknown trigger type: {trigger_type}")

    await _ensure_demo_payers(db)
    results = await process_dishonours(payload, db)
    return {"status": "processed", "dishonours": results}


@router.post("/demo/time-travel")
async def demo_time_travel(db: AsyncSession = Depends(get_db)):
    _require_demo()
    result = await db.execute(select(Dishonour).where(Dishonour.status == "retrying"))
    retrying = result.scalars().all()
    for d in retrying:
        d.status = "recovered"
        d.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "advanced", "recovered": len(retrying)}


@router.post("/demo/reset")
async def demo_reset(db: AsyncSession = Depends(get_db)):
    _require_demo()
    await db.execute(delete(Dishonour))
    await db.execute(delete(Payment))
    await db.execute(delete(PaymentSource))
    await db.execute(delete(Payer))
    await db.commit()
    return {"status": "reset"}


@router.get("/demo/script")
async def demo_script():
    _require_demo()
    return {
        "steps": [
            {"step": 1, "action": "Click Seed Test Data",
             "expected": "4 payers created in Pinch sandbox"},
            {"step": 2, "action": "Click Trigger Mixed Batch",
             "expected": "5 failures processed, redirected to Agent Inbox"},
            {"step": 3, "action": "Show Agent Inbox",
             "expected": "AI explanations visible, 3 auto-recovering, 1 needs reauth, 1 escalated"},
            {"step": 4, "action": "Click Approve Retry on escalated item",
             "expected": "Retry triggered via Pinch API"},
            {"step": 5, "action": "Show Dashboard",
             "expected": "Recovery stats + AI summary visible"},
        ]
    }
