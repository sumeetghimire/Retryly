from app.models.payer import Payer


DISHONOUR_MAP = {
    "insufficient-funds": {
        "type": "soft", "action": "retry", "retry_days": 4,
        "human_label": "Insufficient funds",
        "recoverable": True, "recovery_probability": "High ~68%",
    },
    "refer-to-payer": {
        "type": "soft", "action": "retry", "retry_days": 5,
        "human_label": "Bank unable to process",
        "recoverable": True, "recovery_probability": "High ~60%",
    },
    "payment-stopped-temporarily": {
        "type": "soft", "action": "retry", "retry_days": 7,
        "human_label": "Temporary stop",
        "recoverable": True, "recovery_probability": "Medium ~45%",
    },
    "payment-stopped-temp": {
        "type": "soft", "action": "retry", "retry_days": 7,
        "human_label": "Temporary stop",
        "recoverable": True, "recovery_probability": "Medium ~45%",
    },
    "account-closed": {
        "type": "hard", "action": "reauth", "retry_days": 0,
        "human_label": "Account closed",
        "recoverable": False, "recovery_probability": "Low",
    },
    "invalid-account": {
        "type": "hard", "action": "reauth", "retry_days": 0,
        "human_label": "Invalid account",
        "recoverable": False, "recovery_probability": "Low",
    },
    "payment-returned-not-provided": {
        "type": "hard", "action": "reauth", "retry_days": 0,
        "human_label": "Payment returned",
        "recoverable": False, "recovery_probability": "Low",
    },
    "payment-returned": {
        "type": "hard", "action": "reauth", "retry_days": 0,
        "human_label": "Payment returned",
        "recoverable": False, "recovery_probability": "Low",
    },
    "payment-stopped": {
        "type": "escalate", "action": "escalate", "retry_days": 0,
        "human_label": "Customer stopped payment",
        "recoverable": False, "recovery_probability": "Low",
    },
    "fraudulent-claim": {
        "type": "escalate", "action": "escalate", "retry_days": 0,
        "human_label": "Fraud claim",
        "recoverable": False, "recovery_probability": "Low",
    },
}

DEFAULT_CLASSIFICATION = {
    "type": "escalate", "action": "escalate", "retry_days": 0,
    "human_label": "Unknown failure",
    "recoverable": False, "recovery_probability": "Low",
}


class DishonourClassifier:
    def classify(self, reason_code: str) -> dict:
        return dict(DISHONOUR_MAP.get(reason_code, DEFAULT_CLASSIFICATION))

    def should_offer_plan(self, payer: Payer) -> bool:
        history = payer.payment_history or {}
        failures = history.get("failures", 0)
        return failures >= 2
