import logging
from datetime import date, timedelta
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

PINCH_BASE_URL = "https://api.getpinch.com.au/test"
PINCH_AUTH_URL = "https://auth.getpinch.com.au/connect/token"


class PinchAPIException(Exception):
    def __init__(self, status_code: int, body: Any):
        self.status_code = status_code
        self.body = body
        super().__init__(f"Pinch API error {status_code}: {body}")


def _next_business_day(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


async def _get_access_token() -> str:
    """Exchange App ID + Secret Key for a Bearer token."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            PINCH_AUTH_URL,
            data={
                "grant_type": "client_credentials",
                "scope": "api1",
            },
            auth=(settings.PINCH_APP_ID, settings.PINCH_API_KEY),
        )
        if not response.is_success:
            raise PinchAPIException(response.status_code, response.text)
        data = response.json()
        token = data.get("access_token")
        if not token:
            raise PinchAPIException(0, f"No access_token in response: {data}")
        logger.debug("Pinch access token obtained")
        return token


class PinchService:
    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        token = await _get_access_token()
        self._client = httpx.AsyncClient(
            base_url=PINCH_BASE_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0,
        )
        return self

    async def __aexit__(self, *args):
        if self._client:
            await self._client.aclose()

    def _get_client(self) -> httpx.AsyncClient:
        if not self._client:
            raise RuntimeError("PinchService must be used as async context manager")
        return self._client

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        client = self._get_client()
        logger.debug(f"Pinch {method} {path} kwargs={kwargs}")
        response = await client.request(method, path, **kwargs)
        logger.debug(f"Pinch response {response.status_code}: {response.text[:500]}")
        if not response.is_success:
            raise PinchAPIException(response.status_code, response.text)
        return response.json()

    async def create_payer(self, first_name: str, last_name: str, email: str,
                           phone: str, reference: str) -> dict:
        return await self._request("POST", "/payers", json={
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "phone": phone,
            "reference": reference,
        })

    async def create_payment_source(self, payer_id: str, bsb: str,
                                    account_number: str, account_name: str) -> dict:
        return await self._request("POST", "/payment-sources", json={
            "payerId": payer_id,
            "bsb": bsb,
            "accountNumber": account_number,
            "accountName": account_name,
        })

    async def schedule_payment(self, payer_id: str, source_id: str, amount_cents: int,
                               scheduled_date: str, description: str, reference: str) -> dict:
        return await self._request("POST", "/payments", json={
            "payerId": payer_id,
            "paymentSourceId": source_id,
            "amount": amount_cents,
            "scheduledDate": scheduled_date,
            "description": description,
            "reference": reference,
        })

    async def get_events(self, event_type: str = "bank-results", limit: int = 50) -> dict:
        return await self._request("GET", "/events", params={
            "type": event_type,
            "limit": limit,
        })

    async def calculate_plan_payments(self, total_amount_cents: int,
                                      num_payments: int, frequency: str) -> dict:
        return await self._request("GET", "/payments/calculate-plan-payments", params={
            "totalAmount": total_amount_cents,
            "numberOfPayments": num_payments,
            "frequency": frequency,
        })

    async def create_payment_link(self, payer_id: str, amount_cents: int, description: str) -> dict:
        """Create a Pinch Payment Link for customer re-authorisation."""
        return await self._request("POST", "/payment-links", json={
            "payerId": payer_id,
            "amount": amount_cents,
            "description": description,
        })

    async def retry_payment(self, payer_id: str, source_id: str,
                            amount_cents: int, description: str) -> dict:
        retry_date = _next_business_day(date.today(), 4)
        return await self.schedule_payment(
            payer_id=payer_id,
            source_id=source_id,
            amount_cents=amount_cents,
            scheduled_date=retry_date.isoformat(),
            description=f"[RETRY] {description}",
            reference=f"RETRY-{retry_date.isoformat()}",
        )

    async def seed_test_data(self) -> list[dict]:
        results = []
        test_payers = [
            {
                "first_name": "Sarah", "last_name": "Chen",
                "email": "sarah.chen@example.com", "phone": "0412345001",
                "reference": "SARAH-CHEN-001",
                "bsb": "062-000", "account_number": "12345001",
                "account_name": "Sarah Chen",
                "amount_cents": 50000,
                "description": "Monthly subscription #insufficient-funds",
                "payment_history": {"on_time": 12, "failures": 0},
            },
            {
                "first_name": "James", "last_name": "Brown",
                "email": "james.brown@example.com", "phone": "0412345002",
                "reference": "JAMES-BROWN-002",
                "bsb": "062-000", "account_number": "12345002",
                "account_name": "James Brown",
                "amount_cents": 80000,
                "description": "Monthly invoice #insufficient-funds",
                "payment_history": {"on_time": 6, "failures": 3},
            },
            {
                "first_name": "Mike", "last_name": "Torres",
                "email": "mike.torres@example.com", "phone": "0412345003",
                "reference": "MIKE-TORRES-003",
                "bsb": "062-000", "account_number": "12345003",
                "account_name": "Mike Torres",
                "amount_cents": 35000,
                "description": "Service fee #refer-to-payer",
                "payment_history": {"on_time": 1, "failures": 0},
            },
            {
                "first_name": "Lisa", "last_name": "Park",
                "email": "lisa.park@example.com", "phone": "0412345004",
                "reference": "LISA-PARK-004",
                "bsb": "062-000", "account_number": "12345004",
                "account_name": "Lisa Park",
                "amount_cents": 120000,
                "description": "Annual plan payment #account-closed",
                "payment_history": {"on_time": 8, "failures": 1},
            },
        ]

        scheduled_date = _next_business_day(date.today(), 1).isoformat()

        for tp in test_payers:
            try:
                payer = await self.create_payer(
                    tp["first_name"], tp["last_name"],
                    tp["email"], tp["phone"], tp["reference"],
                )
                payer_id = payer.get("id") or payer.get("data", {}).get("id")

                source = await self.create_payment_source(
                    payer_id, tp["bsb"], tp["account_number"], tp["account_name"]
                )
                source_id = source.get("id") or source.get("data", {}).get("id")

                payment = await self.schedule_payment(
                    payer_id, source_id, tp["amount_cents"],
                    scheduled_date, tp["description"], tp["reference"],
                )

                results.append({
                    "payer": payer,
                    "source": source,
                    "payment": payment,
                    "payment_history": tp["payment_history"],
                })
                logger.info(f"Seeded payer {tp['first_name']} {tp['last_name']}")
            except PinchAPIException as e:
                logger.error(f"Failed to seed {tp['first_name']}: {e}")
                results.append({"error": str(e), "payer_name": f"{tp['first_name']} {tp['last_name']}"})

        return results
