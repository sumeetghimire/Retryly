from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class RiskScorer:
    def calculate_risk_score(self, payer, upcoming_payment=None) -> dict:
        score = 0
        factors: list[str] = []
        history = payer.payment_history or {}
        failures = history.get("failures", 0)
        on_time = history.get("on_time", 0)
        total = failures + on_time

        # Factor 1: Prior failure count
        if failures == 1:
            score += 30
            factors.append("1 prior failure")
        elif failures == 2:
            score += 55
            factors.append("2 prior failures")
        elif failures >= 3:
            score += 75
            factors.append("3+ prior failures")

        # Factor 2: Recent failure (last 30 days)
        last_failure_date = history.get("last_failure_date")
        if last_failure_date:
            try:
                lfd = datetime.fromisoformat(last_failure_date)
                if (datetime.utcnow() - lfd).days <= 30:
                    score += 15
                    factors.append("recent failure in last 30 days")
            except Exception:
                pass

        # Factor 3: Larger than usual amount
        if upcoming_payment and total > 0:
            avg_amount = history.get("avg_payment_cents", 0)
            if avg_amount and upcoming_payment.amount_cents > avg_amount * 1.5:
                score += 10
                factors.append("larger than usual payment amount")

        # Factor 4: Day of week (Monday)
        if upcoming_payment and upcoming_payment.scheduled_at:
            if upcoming_payment.scheduled_at.weekday() == 0:
                score += 5
                factors.append("Monday (statistically higher failure rate)")

        score = min(score, 100)

        if score >= 60:
            risk_level = "high"
            recommendation = "send_pre_debit_reminder"
        elif score >= 30:
            risk_level = "medium"
            recommendation = "monitor"
        else:
            risk_level = "low"
            recommendation = "none"

        return {
            "score": score,
            "risk_level": risk_level,
            "factors": factors,
            "recommendation": recommendation,
        }
