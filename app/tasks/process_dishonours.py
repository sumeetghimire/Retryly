import logging
from datetime import datetime, date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.payment import Payment
from app.models.payer import Payer
from app.models.dishonour import Dishonour
from app.services.dishonour_classifier import DishonourClassifier
from app.services.claude_service import ClaudeService
from app.services.pinch_service import PinchService, PinchAPIException
from app.services.retry_scheduler import RetryScheduler

logger = logging.getLogger(__name__)

classifier = DishonourClassifier()
claude = ClaudeService()
scheduler = RetryScheduler()

HARD_CODES = {
    "account-closed", "invalid-account", "payment-returned-not-provided",
    "payment-returned", "payment-stopped", "fraudulent-claim",
}

DEFAULT_MAX_RETRIES = 3
DEFAULT_COOLDOWN_DAYS = 3


def can_retry(dishonour: Dishonour, max_retries: int = DEFAULT_MAX_RETRIES, cooldown_days: int = DEFAULT_COOLDOWN_DAYS) -> tuple[bool, str]:
    if dishonour.reason_code in HARD_CODES:
        return False, "Hard failure code — do not retry"
    if dishonour.retry_attempt_count >= max_retries:
        return False, f"Max retries ({max_retries}) reached"
    if dishonour.last_retry_at:
        days_since = (datetime.utcnow() - dishonour.last_retry_at).days
        if days_since < cooldown_days:
            remaining = cooldown_days - days_since
            return False, f"Cooldown active — {remaining} days remaining"
    if dishonour.status == "escalated":
        return False, "Manually escalated — awaiting human decision"
    return True, "OK to retry"


async def process_dishonours(payload: dict, db: AsyncSession) -> list[dict]:
    results = []
    failed_payments = payload.get("data", {}).get("failedPayments", [])

    if not failed_payments:
        failed_payments = payload.get("failedPayments", [])

    from app.services.credential_store import get_active_credentials
    _cred_key, _cred_app_id, _cred_mode = get_active_credentials()

    for fp in failed_payments:
        pinch_payment_id = fp.get("paymentId") or fp.get("id")
        reason_code = fp.get("dishonourCode") or fp.get("reasonCode", "unknown")
        amount_cents = int(fp.get("amount", 0))

        payment = None
        payer = None

        if pinch_payment_id:
            result = await db.execute(
                select(Payment).where(Payment.pinch_payment_id == pinch_payment_id)
            )
            payment = result.scalar_one_or_none()

        if payment:
            result = await db.execute(
                select(Payer).where(Payer.id == payment.payer_id)
            )
            payer = result.scalar_one_or_none()
            amount_cents = payment.amount_cents

        # If payment/payer not in DB (real webhook, no prior sync), create from payload
        if not payer:
            pinch_payer_id = str(fp.get("payerId") or fp.get("payer_id") or "")
            if pinch_payer_id:
                result = await db.execute(
                    select(Payer).where(Payer.pinch_payer_id == pinch_payer_id)
                )
                payer = result.scalar_one_or_none()
            if not payer:
                # Build from webhook fields
                raw_name = (
                    fp.get("payerName")
                    or fp.get("payer_name")
                    or f"{fp.get('firstName', '')} {fp.get('lastName', '')}".strip()
                    or "Unknown"
                )
                email = fp.get("payerEmail") or fp.get("email") or ""
                phone = fp.get("payerPhone") or fp.get("phone") or None
                if not pinch_payer_id:
                    pinch_payer_id = f"webhook_{pinch_payment_id or 'unknown'}"
                payer = Payer(
                    pinch_payer_id=pinch_payer_id,
                    name=raw_name,
                    email=email,
                    phone=phone,
                    payment_history={"on_time": 0, "failures": 1},
                )
                db.add(payer)
                await db.flush()  # get payer.id
                logger.info(f"Created payer on-the-fly from webhook: {raw_name} ({pinch_payer_id})")

        if not payment and pinch_payment_id and payer:
            payment = Payment(
                payer_id=payer.id,
                pinch_payment_id=pinch_payment_id,
                amount_cents=amount_cents,
                status="failed",
            )
            db.add(payment)
            await db.flush()
            logger.info(f"Created payment on-the-fly from webhook: {pinch_payment_id} ${amount_cents/100:.2f}")

        classification = classifier.classify(reason_code)
        action = classification["action"]

        if payer and classifier.should_offer_plan(payer):
            action = "plan"
            classification["action"] = "plan"

        payer_name = payer.name if payer else fp.get("payerName", "Unknown")
        payment_history = payer.payment_history if payer else {}
        failures = payment_history.get("failures", 0)
        failure_date = datetime.utcnow().strftime("%d %B %Y")
        first_name = payer_name.split()[0] if payer_name else "Customer"

        # Smart retry timing (Prompt 3)
        retry_scheduled_date = None
        retry_timing_reason = None
        if action == "retry":
            retry_scheduled_date, retry_timing_reason = scheduler.calculate_optimal_retry_date(
                reason_code=reason_code,
                payer=payer,
                failure_date=date.today(),
            )
            logger.info(f"Retry timing: {retry_scheduled_date} — {retry_timing_reason}")

        retry_date_str = retry_scheduled_date.strftime("%-d %B %Y") if retry_scheduled_date else None

        try:
            explanation = await claude.explain_dishonour(
                payer_name=payer_name,
                amount_cents=amount_cents,
                reason_code=reason_code,
                reason_label=classification["human_label"],
                payment_history=payment_history,
                action_taken=action,
                retry_date=retry_date_str,
            )
        except Exception as e:
            logger.error(f"Claude explain failed: {e}")
            explanation = f"Payment of ${amount_cents/100:.2f} failed due to {classification['human_label']}. Action taken: {action}."

        try:
            customer_message = await claude.generate_customer_message(
                payer_first_name=first_name,
                amount_cents=amount_cents,
                failure_date=failure_date,
                reason_label=classification["human_label"],
                action=action,
                reason_code=reason_code,
                retry_date=retry_date_str,
                failures=failures,
                channel="email",
            )
        except Exception as e:
            logger.error(f"Claude customer message failed: {e}")
            customer_message = f"Hi {first_name}, we noticed your payment of ${amount_cents/100:.2f} was unsuccessful. Please contact us."

        try:
            sms_message = await claude.generate_customer_message(
                payer_first_name=first_name,
                amount_cents=amount_cents,
                failure_date=failure_date,
                reason_label=classification["human_label"],
                action=action,
                reason_code=reason_code,
                retry_date=retry_date_str,
                failures=failures,
                channel="sms",
            )
        except Exception as e:
            logger.error(f"Claude SMS message failed: {e}")
            sms_message = f"Hi {first_name}, your ${amount_cents/100:.2f} payment failed. Please contact us urgently."

        retry_payment_id = None
        plan_options = None
        reauth_link = None
        payment_link_url = None
        payment_link_expires_at = None
        nonce = None
        duplicate_prevented = False

        if action == "retry" and payer and payment:
            attempt_num = 1  # new dishonour, so attempt 1
            nonce = f"retryly-{pinch_payment_id or 'unk'}-attempt-{attempt_num}"
            try:
                async with PinchService(api_key=_cred_key, app_id=_cred_app_id, mode=_cred_mode) as pinch:
                    retry = await pinch.schedule_payment(
                        payer_id=payer.pinch_payer_id,
                        source_id=fp.get("paymentSourceId", ""),
                        amount_cents=amount_cents,
                        scheduled_date=retry_scheduled_date.isoformat() if retry_scheduled_date else date.today().isoformat(),
                        description=f"[RETRY] {fp.get('description', 'Payment retry')}",
                        reference=nonce,
                    )
                    retry_payment_id = retry.get("id")
                    payment.status = "retrying"
            except PinchAPIException as e:
                logger.error(f"Pinch retry failed: {e}")

        elif action == "plan":
            try:
                async with PinchService(api_key=_cred_key, app_id=_cred_app_id, mode=_cred_mode) as pinch:
                    plan_options_list = await pinch.get_plan_options(amount_cents)
                    plan_options = {"options": plan_options_list}
            except Exception as e:
                logger.error(f"Pinch plan options failed: {e}")
                plan_options = {
                    "options": [
                        {"num_payments": 2, "frequency": "fortnightly", "recommended": False, "amount_per_payment": amount_cents // 2, "total": amount_cents},
                        {"num_payments": 3, "frequency": "fortnightly", "recommended": True, "amount_per_payment": amount_cents // 3, "total": amount_cents},
                        {"num_payments": 4, "frequency": "monthly", "recommended": False, "amount_per_payment": amount_cents // 4, "total": amount_cents},
                    ]
                }

        elif action == "reauth" and payer:
            try:
                async with PinchService(api_key=_cred_key, app_id=_cred_app_id, mode=_cred_mode) as pinch:
                    link_data = await pinch.create_payment_link(
                        payer_id=payer.pinch_payer_id,
                        amount_cents=amount_cents,
                        description=f"Update payment details — {classification['human_label']}",
                        expires_in_days=7,
                        reference=str(pinch_payment_id or ""),
                    )
                    payment_link_url = (
                        link_data.get("url")
                        or link_data.get("link")
                        or link_data.get("data", {}).get("url")
                    )
                    reauth_link = payment_link_url
                    from datetime import timedelta
                    payment_link_expires_at = datetime.utcnow() + timedelta(days=7)
            except PinchAPIException as e:
                logger.error(f"Pinch payment link failed: {e}")

        status_map = {
            "retry": "retrying",
            "reauth": "needs_attention",
            "plan": "needs_attention",
            "escalate": "needs_attention",
        }

        dishonour = Dishonour(
            payment_id=payment.id if payment else None,
            payer_id=payer.id if payer else None,
            reason_code=reason_code,
            reason_label=classification["human_label"],
            action_taken=action,
            retry_payment_id=retry_payment_id,
            claude_explanation=explanation,
            claude_customer_message=customer_message,
            claude_sms_message=sms_message,
            reauth_link=reauth_link,
            status=status_map.get(action, "needs_attention"),
            # Prompt 3
            retry_scheduled_date=retry_scheduled_date,
            retry_timing_reason=retry_timing_reason,
            # Prompt 4
            plan_options=plan_options,
            # Prompt 5
            payment_link_url=payment_link_url,
            payment_link_expires_at=payment_link_expires_at,
            payment_link_status="sent" if payment_link_url else "sent",
            # Prompt 8
            retry_attempt_count=1 if action == "retry" else 0,
            last_retry_at=datetime.utcnow() if action == "retry" else None,
            nonce=nonce,
        )
        db.add(dishonour)

        results.append({
            "payer_name": payer_name,
            "amount_cents": amount_cents,
            "reason_code": reason_code,
            "action": action,
            "classification": classification,
            "explanation": explanation,
            "customer_message": customer_message,
            "sms_message": sms_message,
            "plan_options": plan_options,
            "reauth_link": reauth_link,
            "retry_scheduled_date": retry_scheduled_date.isoformat() if retry_scheduled_date else None,
            "retry_timing_reason": retry_timing_reason,
        })

        logger.info(f"Processed dishonour: {payer_name} ${amount_cents/100:.2f} → {action}"
                    + (f" (retry: {retry_scheduled_date})" if retry_scheduled_date else ""))

    await db.commit()
    return results
