import logging
from datetime import datetime, date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.payment import Payment
from app.models.payer import Payer
from app.models.dishonour import Dishonour
from app.services.risk_scorer import RiskScorer

logger = logging.getLogger(__name__)

_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
_RISK_ORDER = {"high": 0, "medium": 1, "low": 2}


class CashFlowForecaster:

    async def generate_forecast(
        self,
        db: AsyncSession,
        risk_scorer: RiskScorer,
        sent_reminders: set[int],
    ) -> dict:
        """
        Generates a 14-day forward cash flow forecast from scheduled DB payments.
        Groups by date, applies risk scoring, calculates best/worst case totals.
        """
        today = date.today()
        horizon = today + timedelta(days=14)
        window_start = datetime.combine(today, datetime.min.time())
        window_end = datetime.combine(horizon, datetime.min.time())

        # Step 1: Get scheduled/pending payments in next 14 days
        result = await db.execute(
            select(Payment, Payer)
            .join(Payer, Payment.payer_id == Payer.id)
            .where(
                and_(
                    Payment.status.in_(["scheduled", "pending"]),
                    Payment.scheduled_at >= window_start,
                    Payment.scheduled_at < window_end,
                )
            )
            .order_by(Payment.scheduled_at)
        )
        rows = result.all()

        # Step 2: Get historical recovery rate from dishonour history
        dishonour_result = await db.execute(select(Dishonour))
        all_dishonours = dishonour_result.scalars().all()
        total_d = len(all_dishonours)
        recovered_d = sum(1 for d in all_dishonours if d.status == "recovered")
        historical_recovery_rate = (recovered_d / total_d) if total_d > 0 else 0.65

        # Step 3: Score each payment and group by date
        daily_map: dict[date, list[dict]] = {}
        best_case_cents = 0
        high_risk_cents = 0
        medium_risk_cents = 0
        high_risk_count = 0
        medium_risk_count = 0
        low_risk_count = 0

        for payment, payer in rows:
            risk = risk_scorer.calculate_risk_score(payer, payment)
            risk_level = risk["risk_level"]

            payment_date = payment.scheduled_at.date() if payment.scheduled_at else today

            entry = {
                "payment_id": payment.id,
                "payer_id": payer.id,
                "payer_name": payer.name,
                "amount_cents": payment.amount_cents,
                "risk_level": risk_level,
                "risk_score": risk["score"],
                "risk_factors": risk["factors"],
                "pre_debit_reminder_sent": payer.id in sent_reminders,
            }

            daily_map.setdefault(payment_date, []).append(entry)
            best_case_cents += payment.amount_cents

            if risk_level == "high":
                high_risk_count += 1
                high_risk_cents += payment.amount_cents
            elif risk_level == "medium":
                medium_risk_count += 1
                medium_risk_cents += payment.amount_cents
            else:
                low_risk_count += 1

        at_risk_total_cents = high_risk_cents + medium_risk_cents
        worst_case_cents = best_case_cents - high_risk_cents
        retryly_recovers_cents = int(
            medium_risk_cents * max(historical_recovery_rate, 0.50)
            + high_risk_cents * 0.20
        )

        # Step 4: Build daily buckets
        daily_forecast = []
        biggest_risk_date: str | None = None
        biggest_risk_amount = 0
        biggest_risk_payers: list[str] = []

        for d in sorted(daily_map.keys()):
            payments = sorted(daily_map[d], key=lambda x: _RISK_ORDER[x["risk_level"]])
            day_total = sum(p["amount_cents"] for p in payments)
            day_safe = sum(p["amount_cents"] for p in payments if p["risk_level"] == "low")
            day_medium = sum(p["amount_cents"] for p in payments if p["risk_level"] == "medium")
            day_high = sum(p["amount_cents"] for p in payments if p["risk_level"] == "high")
            day_at_risk = day_medium + day_high

            days_from_now = (d - today).days
            day_label = f"{_DAY_NAMES[d.weekday()]} {d.day} {_MONTH_NAMES[d.month - 1]}"

            bucket = {
                "date": d.isoformat(),
                "day_label": day_label,
                "days_from_now": days_from_now,
                "payments": payments,
                "day_total_cents": day_total,
                "day_at_risk_cents": day_at_risk,
                "day_safe_cents": day_safe,
                "day_medium_cents": day_medium,
                "day_high_cents": day_high,
            }
            daily_forecast.append(bucket)

            if day_at_risk > biggest_risk_amount:
                biggest_risk_amount = day_at_risk
                biggest_risk_date = day_label
                at_risk_on_day = [p for p in payments if p["risk_level"] in ("high", "medium")]
                at_risk_on_day.sort(key=lambda x: x["amount_cents"], reverse=True)
                biggest_risk_payers = [p["payer_name"] for p in at_risk_on_day[:2]]

        pre_debit_sent = sum(
            1 for buckets in daily_map.values()
            for p in buckets if p["pre_debit_reminder_sent"]
        )
        at_risk_payer_count = high_risk_count + medium_risk_count
        pre_debit_pending = max(0, at_risk_payer_count - pre_debit_sent)

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "forecast_days": 14,
            "daily_forecast": daily_forecast,
            "summary": {
                "best_case_cents": best_case_cents,
                "worst_case_cents": worst_case_cents,
                "at_risk_total_cents": at_risk_total_cents,
                "retryly_recovers_cents": retryly_recovers_cents,
                "high_risk_count": high_risk_count,
                "medium_risk_count": medium_risk_count,
                "low_risk_count": low_risk_count,
                "biggest_risk_date": biggest_risk_date,
                "biggest_risk_amount_cents": biggest_risk_amount,
                "biggest_risk_payers": biggest_risk_payers,
            },
            "pre_debit_reminders_sent": pre_debit_sent,
            "pre_debit_reminders_pending": pre_debit_pending,
        }
