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
        first_failure = failures == 0  # this is their first failure
        retry_sentence = f"A retry has been scheduled for {retry_date}." if retry_date else ""

        # Tone calibration based on failure history
        if first_failure:
            tone_note = "This is their first ever failure — assume good faith, be gentle."
        elif failures == 1:
            tone_note = "Second failure — be warm but slightly firmer."
        else:
            tone_note = "Third or more failure — be direct and mention payment options are available."

        user_prompt = (
            f"A direct debit payment failed for {payer_name}.\n"
            f"Amount: ${amount_dollars:.2f}\n"
            f"Reason: {reason_label} ({reason_code})\n"
            f"Payment history: {on_time} payments on time, {failures} prior failures. First failure: {first_failure}.\n"
            f"Tone: {tone_note}\n"
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
        reason_code: str = "",
        retry_date: str | None = None,
        payment_link_url: str | None = None,
        failures: int = 0,
        plan_options: dict | None = None,
        channel: str = "email",
    ) -> str:
        from datetime import date as dt_date
        amount_dollars = amount_cents / 100

        # Reason-specific and payday-aware context
        if reason_code in ("account-closed", "invalid-account"):
            action_context = (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"We had trouble processing their payment — their details may need updating. "
                f"Ask them to update their payment details via [LINK]. Never use words 'closed' or 'invalid'."
            )
        elif reason_code == "refer-to-payer":
            action_context = (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"Their bank flagged this payment — this is usually resolved quickly. "
                f"We will retry automatically."
            )
        elif reason_code == "payment-stopped":
            action_context = (
                f"We noticed their payment of ${amount_dollars:.2f} didn't go through. "
                f"Ask them to get in touch so we can sort this out. Keep it warm and professional."
            )
        elif action == "retry":
            # Payday-aware retry message
            retry_day_note = ""
            if retry_date:
                try:
                    from datetime import datetime
                    rd = datetime.strptime(retry_date, "%Y-%m-%d")
                    if rd.weekday() == 4:  # Friday
                        retry_day_note = "We'll try again next week — most people find start of week works better."
                    else:
                        retry_day_note = f"We'll automatically retry on {retry_date}."
                except Exception:
                    retry_day_note = f"We will automatically retry on {retry_date}." if retry_date else ""

            if failures >= 2:
                action_context = (
                    f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                    f"We'd like to offer a flexible payment plan to make this easier to manage. "
                    f"Ask them to get in touch."
                )
            else:
                action_context = (
                    f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                    f"{retry_day_note} Ask them to ensure sufficient funds are available."
                )
        elif action == "plan":
            installment = amount_dollars / 3
            action_context = (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"Offer to split this into 3 fortnightly payments of ${installment:.2f} each. "
                f"Include [LINK] to accept the plan."
            )
        elif action == "reauth":
            link_text = f" Payment link: {payment_link_url}" if payment_link_url else " via [LINK]"
            action_context = (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"We had trouble processing their payment — their details may need updating. "
                f"Ask them to update via{link_text}. Be warm and reassuring."
            )
        else:
            action_context = (
                f"Their payment of ${amount_dollars:.2f} failed on {failure_date}. "
                f"Ask them to contact the business. Be professional, not alarming."
            )

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

    async def generate_pre_debit_reminder(self, payer_name: str, amount_cents: int, payment_date: str, failures: int) -> str:
        """Pre-debit reminder for high-risk payers."""
        first_name = payer_name.split()[0] if payer_name else "Customer"
        amount_dollars = amount_cents / 100
        user_prompt = (
            f"Write a 2-sentence email/SMS reminding {first_name} their payment of "
            f"${amount_dollars:.2f} will be processed on {payment_date}. "
            f"They have had {failures} payment issue(s) before so be warm but clear."
        )
        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=150,
                system=(
                    "You are sending a friendly heads-up to a customer before we attempt their payment. "
                    "Be warm, brief, not alarming. Australian English. No markdown. Plain text only."
                ),
                messages=[{"role": "user", "content": user_prompt}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Claude pre_debit_reminder failed: {e}")
            return (
                f"Hi {first_name}, a friendly reminder that your payment of ${amount_dollars:.2f} "
                f"is due on {payment_date}. Please ensure funds are available."
            )

    async def generate_recovery_summary_email(self, business_name: str, stats: dict) -> str:
        """Daily recovery summary for the business owner."""
        user_prompt = (
            f"Last night: {stats.get('total', 0)} payments processed, "
            f"{stats.get('failed', 0)} failed, "
            f"{stats.get('recovered', 0)} auto-recovered, "
            f"{stats.get('needs_attention', 0)} need attention. "
            f"Estimated recovery: ${stats.get('recovery_cents', 0) / 100:.2f}. "
            f"Write the summary for {business_name}."
        )
        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=200,
                system=(
                    "You are writing a daily payment recovery summary for an Australian small business owner. "
                    "Be direct, clear, numbers-first. Max 4 sentences. "
                    "One actionable next step at the end. No markdown. Plain text."
                ),
                messages=[{"role": "user", "content": user_prompt}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Claude recovery_summary failed: {e}")
            failed = stats.get("failed", 0)
            recovered = stats.get("recovered", 0)
            return (
                f"{failed} payments failed overnight, {recovered} are auto-recovering. "
                f"Check your Agent Inbox for items needing attention."
            )

    async def generate_surcharge_insight(self, payers_on_card: int, monthly_amount: float) -> str:
        """1-2 sentence insight about the RBA surcharge ban impact."""
        user_prompt = (
            f"The RBA is banning card surcharging from 1 October 2026. "
            f"This business has {payers_on_card} customers paying by card, "
            f"costing ${monthly_amount:.2f}/month in fees they currently pass on. "
            f"After the ban they must absorb these fees. "
            f"Write 2 sentences explaining the impact and the benefit of switching to "
            f"Pinch direct debit before the deadline. AUD amounts. Direct and practical. Australian English."
        )
        try:
            response = await self._client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=150,
                system="You are a concise financial advisor for Australian SMBs. Plain text. No markdown.",
                messages=[{"role": "user", "content": user_prompt}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Claude surcharge_insight failed: {e}")
            return (
                f"From 1 October 2026, you'll need to absorb card surcharge fees for your "
                f"{payers_on_card} card-paying customers — costing approximately ${monthly_amount:.2f}/month. "
                f"Switching them to Pinch direct debit now eliminates this cost entirely."
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
