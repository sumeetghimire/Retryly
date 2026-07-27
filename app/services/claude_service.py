import logging
import anthropic

from app.config import settings

logger = logging.getLogger(__name__)


class ClaudeService:
    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def ping(self):
        msg = await self._client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=10,
            messages=[{"role": "user", "content": "ping"}],
        )
        return msg

    async def explain_dishonour(
        self,
        payer_name: str,
        amount_cents: int,
        reason_code: str,
        reason_label: str,
        payment_history: dict,
        action_taken: str,
        retry_date: str | None = None,
    ) -> str:
        amount_dollars = amount_cents / 100
        on_time = payment_history.get("on_time", 0)
        failures = payment_history.get("failures", 0)
        retry_sentence = f"A retry has been scheduled for {retry_date}." if retry_date else ""

        user_prompt = (
            f"A direct debit payment failed for {payer_name}.\n"
            f"Amount: ${amount_dollars:.2f}\n"
            f"Reason: {reason_label} ({reason_code})\n"
            f"Payment history: {on_time} payments on time, {failures} failures\n"
            f"Action taken: {action_taken}\n"
            f"{retry_sentence}\n\n"
            f"Write 2 sentences for the business owner: what happened and what Retryly has done about it."
        )

        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=300,
                system=(
                    "You are Retryly, an AI accounts receivable assistant for Australian "
                    "small businesses. Explain failed payment events clearly and professionally. "
                    "Be factual, concise, and action-oriented. Write exactly 2 plain sentences. "
                    "Use Australian English. Dollar amounts are in AUD. "
                    "No markdown, no bullet points, no asterisks, no bold, no headers."
                ),
                messages=[{"role": "user", "content": user_prompt}],
            )
            result = response.content[0].text
            logger.debug(f"Claude explain: {result}")
            return result
        except Exception as e:
            logger.error(f"Claude explain_dishonour failed: {e}")
            return (
                f"{payer_name}'s payment of ${amount_dollars:.2f} failed due to {reason_label}. "
                f"Retryly has automatically taken action: {action_taken}."
            )

    async def generate_customer_message(
        self,
        payer_first_name: str,
        amount_cents: int,
        failure_date: str,
        reason_label: str,
        action: str,
        retry_date: str | None = None,
        plan_options: dict | None = None,
        channel: str = "email",
    ) -> str:
        amount_dollars = amount_cents / 100

        action_context = {
            "retry": (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"We will automatically retry in a few days. Ask them to ensure sufficient funds are available."
            ),
            "reauth": (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date} due to an account issue. "
                f"Ask them to update their bank details via [LINK]. Be reassuring and professional."
            ),
            "plan": (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"Offer to split this into 3 fortnightly payments of ${amount_dollars/3:.2f} each. "
                f"Include [LINK] to accept the plan."
            ),
            "escalate": (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"Ask them to contact the business urgently. Be professional, not alarming."
            ),
        }.get(action, f"Their payment of ${amount_dollars:.2f} failed on {failure_date}.")

        if channel == "sms":
            format_instruction = "For SMS: strictly under 160 characters, no subject line."
        else:
            format_instruction = "For email: maximum 3 short paragraphs, include a subject line prefixed with 'Subject:'."

        user_prompt = (
            f"Write a message to customer {payer_first_name}.\n"
            f"{action_context}\n"
            f"{format_instruction}"
        )

        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=400,
                system=(
                    "You are writing on behalf of an Australian small business to their customer "
                    "about a failed payment. Be professional, warm, and brief. "
                    "Never be accusatory or alarming. Use Australian English. "
                    "No markdown, no asterisks, no bullet points, no bold formatting. "
                    "Plain text only."
                ),
                messages=[{"role": "user", "content": user_prompt}],
            )
            result = response.content[0].text
            logger.debug(f"Claude customer message: {result}")
            return result
        except Exception as e:
            logger.error(f"Claude generate_customer_message failed: {e}")
            return (
                f"Subject: Payment Notification\n\n"
                f"Hi {payer_first_name},\n\n"
                f"We noticed your recent payment of ${amount_dollars:.2f} was unsuccessful. "
                f"Please get in touch with us so we can resolve this together.\n\n"
                f"Kind regards"
            )

    async def generate_agent_summary(self, dishonours: list[dict]) -> str:
        # Exclude $0 entries (unmatched payers with no payment record)
        real = [d for d in dishonours if d.get("amount_cents", 0) > 0]

        if not real:
            return "No failed payments overnight. All payments processed successfully."

        lines = []
        for d in real:
            payer = d.get("payer_name", "Unknown")
            amount = d.get("amount_cents", 0) / 100
            reason = d.get("reason_label", "unknown")
            action = d.get("action_taken", "unknown")
            lines.append(f"{payer}: ${amount:.2f}, {reason}, action: {action}")

        user_prompt = (
            "Tonight's failed payments:\n"
            + "\n".join(lines)
            + "\n\nSummarise: total failed, total $ at risk, how many auto-recovering, "
            "any items needing human attention. Write 3-4 plain sentences only."
        )

        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=200,
                system=(
                    "You are Retryly, an AI accounts receivable assistant. "
                    "Summarise overnight payment results for a business owner in plain prose. "
                    "Be direct and optimistic where recovery is likely. "
                    "Write exactly 3 sentences. "
                    "Use Australian English and AUD dollar signs. "
                    "IMPORTANT: No markdown. No bullet points. No asterisks. No headers. "
                    "Plain sentences only."
                ),
                messages=[{"role": "user", "content": user_prompt}],
            )
            result = response.content[0].text.strip()
            logger.debug(f"Claude summary: {result}")
            return result
        except Exception as e:
            logger.error(f"Claude generate_agent_summary failed: {e}")
            total = sum(d.get("amount_cents", 0) for d in real) / 100
            return (
                f"{len(real)} payments failed tonight totalling ${total:.2f}. "
                f"Retryly is automatically processing recoverable failures."
            )
