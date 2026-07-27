import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.payment import Payment
from app.models.payer import Payer
from app.models.dishonour import Dishonour
from app.services.dishonour_classifier import DishonourClassifier
from app.services.claude_service import ClaudeService
from app.services.pinch_service import PinchService, PinchAPIException

logger = logging.getLogger(__name__)

classifier = DishonourClassifier()
claude = ClaudeService()


async def process_dishonours(payload: dict, db: AsyncSession) -> list[dict]:
    results = []
    failed_payments = payload.get("data", {}).get("failedPayments", [])

    if not failed_payments:
        failed_payments = payload.get("failedPayments", [])

    for fp in failed_payments:
        pinch_payment_id = fp.get("paymentId") or fp.get("id")
        reason_code = fp.get("dishonourCode") or fp.get("reasonCode", "unknown")
        amount_cents = fp.get("amount", 0)

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

        classification = classifier.classify(reason_code)
        action = classification["action"]

        if payer and classifier.should_offer_plan(payer):
            action = "plan"
            classification["action"] = "plan"

        payer_name = payer.name if payer else fp.get("payerName", "Unknown")
        payment_history = payer.payment_history if payer else {}
        failure_date = datetime.utcnow().strftime("%d %B %Y")
        first_name = payer_name.split()[0] if payer_name else "Customer"

        try:
            explanation = await claude.explain_dishonour(
                payer_name=payer_name,
                amount_cents=amount_cents,
                reason_code=reason_code,
                reason_label=classification["human_label"],
                payment_history=payment_history,
                action_taken=action,
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
                channel="sms",
            )
        except Exception as e:
            logger.error(f"Claude SMS message failed: {e}")
            sms_message = f"Hi {first_name}, your ${amount_cents/100:.2f} payment failed. Please contact us urgently."

        retry_payment_id = None
        plan_options = None
        reauth_link = None

        if action == "retry" and payer and payment:
            try:
                async with PinchService() as pinch:
                    pinch_payer = await db.execute(
                        select(Payer).where(Payer.id == payment.payer_id)
                    )
                    p = pinch_payer.scalar_one_or_none()
                    if p:
                        retry = await pinch.retry_payment(
                            payer_id=p.pinch_payer_id,
                            source_id=fp.get("paymentSourceId", ""),
                            amount_cents=amount_cents,
                            description=fp.get("description", "Payment retry"),
                        )
                        retry_payment_id = retry.get("id")
                        payment.status = "retrying"
            except PinchAPIException as e:
                logger.error(f"Pinch retry failed: {e}")

        elif action == "plan":
            try:
                async with PinchService() as pinch:
                    plan_options = await pinch.calculate_plan_payments(
                        total_amount_cents=amount_cents,
                        num_payments=3,
                        frequency="fortnightly",
                    )
            except PinchAPIException as e:
                logger.error(f"Pinch plan calc failed: {e}")
                plan_options = {
                    "payments": amount_cents // 3,
                    "count": 3,
                    "frequency": "fortnightly",
                }

        elif action == "reauth" and payer:
            try:
                async with PinchService() as pinch:
                    link_data = await pinch.create_payment_link(
                        payer_id=payer.pinch_payer_id,
                        amount_cents=amount_cents,
                        description=f"Re-authorise payment - {classification['human_label']}",
                    )
                    reauth_link = link_data.get("url") or link_data.get("link") or link_data.get("data", {}).get("url")
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
        })

        logger.info(f"Processed dishonour: {payer_name} ${amount_cents/100:.2f} → {action}")

    await db.commit()
    return results
