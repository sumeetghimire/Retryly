from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)

BASE_RETRY_DAYS = {
    "insufficient-funds": 4,
    "refer-to-payer": 5,
    "payment-stopped-temporarily": 7,
    "payment-stopped-temp": 7,
}


class RetryScheduler:
    def calculate_optimal_retry_date(self, reason_code: str, payer=None, failure_date: date | None = None) -> tuple[date, str]:
        """
        Returns (optimal_retry_date, timing_reason).
        Considers: dishonour type, payday patterns, day-of-week patterns from history.
        """
        start = failure_date or date.today()
        base_days = BASE_RETRY_DAYS.get(reason_code, 4)
        adjustments: list[str] = []

        # Step 1: Calculate base date using business days
        calculated = self.calculate_business_days(start, base_days)

        # Step 2: Avoid Monday (higher failure rate)
        if calculated.weekday() == 0:  # Monday
            calculated += timedelta(days=1)
            adjustments.append("pushed off Monday (higher failure rate)")

        # Step 3: Avoid weekends (shouldn't happen with business days, but safety check)
        while calculated.weekday() >= 5:
            calculated += timedelta(days=1)

        # Step 4: Avoid 14th-15th (payday congestion — funds not yet cleared)
        if calculated.day in (14, 15):
            calculated = calculated.replace(day=16)
            adjustments.append("avoided 14th/15th (payday congestion)")

        # Step 5: Check for weekend after day adjustment
        while calculated.weekday() >= 5:
            calculated += timedelta(days=1)

        # Step 6: Payer history — prefer successful days, avoid failure days
        if payer:
            history = payer.payment_history or {}
            success_day = history.get("preferred_day")
            failure_day = history.get("failure_day")

            if failure_day is not None and calculated.weekday() == failure_day:
                calculated += timedelta(days=1)
                if calculated.weekday() >= 5:
                    calculated += timedelta(days=2)
                adjustments.append(f"avoided prior failure day ({_day_name(failure_day)})")

            if success_day is not None and success_day != (failure_day or -1):
                # Try to nudge toward the preferred day within ±2 days
                for delta in range(-2, 3):
                    candidate = calculated + timedelta(days=delta)
                    if candidate.weekday() == success_day and candidate >= start:
                        calculated = candidate
                        adjustments.append(f"aligned to prior success day ({_day_name(success_day)})")
                        break

        # Step 7: Cap at 14 days from failure
        max_date = start + timedelta(days=14)
        if calculated > max_date:
            calculated = max_date
            while calculated.weekday() >= 5:
                calculated -= timedelta(days=1)
            adjustments.append("capped at 14-day maximum")

        # Build timing reason
        day_name = _day_name(calculated.weekday())
        if adjustments:
            reason = f"Scheduled for {day_name} — {', '.join(adjustments)}"
        else:
            reason = f"Scheduled for {day_name} — optimal recovery window"

        logger.info(f"Retry scheduled: {calculated} ({reason})")
        return calculated, reason

    def calculate_business_days(self, from_date: date, days: int) -> date:
        current = from_date
        added = 0
        while added < days:
            current += timedelta(days=1)
            if current.weekday() < 5:
                added += 1
        return current


def _day_name(weekday: int) -> str:
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][weekday]
