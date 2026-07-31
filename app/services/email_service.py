import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"


def _parse_subject_and_body(message: str) -> tuple[str, str]:
    """Split Claude-generated message into subject and body."""
    lines = message.strip().split("\n")
    if lines and lines[0].lower().startswith("subject:"):
        subject = lines[0][8:].strip()
        body = "\n".join(lines[1:]).strip()
        return subject, body
    return "Payment Update", message.strip()


class EmailService:
    def __init__(self):
        self._api_key = settings.SENDGRID_API_KEY
        self._from_email = settings.FROM_EMAIL
        self._from_name = settings.FROM_NAME

    def _enabled(self) -> bool:
        return bool(self._api_key)

    async def send(self, to_email: str, to_name: str, subject: str, body: str) -> bool:
        """
        Send a plain-text email via SendGrid.
        Returns True on success, False if SendGrid is not configured.
        Logs but never raises — email is best-effort, never crash the API.
        """
        if not self._enabled():
            logger.info(
                f"[EMAIL SKIPPED — no SENDGRID_API_KEY] To: {to_email} | Subject: {subject}"
            )
            return False

        payload = {
            "personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
            "from": {"email": self._from_email, "name": self._from_name},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body}],
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    SENDGRID_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
            if response.is_success or response.status_code == 202:
                logger.info(f"Email sent to {to_email}: {subject}")
                return True
            else:
                logger.warning(
                    f"SendGrid returned {response.status_code} for {to_email}: {response.text[:200]}"
                )
                return False
        except Exception as e:
            logger.error(f"Email send failed to {to_email}: {e}")
            return False

    async def send_customer_message(
        self,
        payer_email: str,
        payer_name: str,
        claude_message: str,
    ) -> bool:
        """Send the AI-drafted customer message to a payer."""
        subject, body = _parse_subject_and_body(claude_message)
        return await self.send(payer_email, payer_name, subject, body)

    async def send_pre_debit_reminder(
        self,
        payer_email: str,
        payer_name: str,
        reminder_message: str,
    ) -> bool:
        """Send a pre-debit reminder to a payer before their payment is due."""
        subject = f"Upcoming payment reminder — {payer_name.split()[0]}, your payment is due soon"
        return await self.send(payer_email, payer_name, subject, reminder_message)
