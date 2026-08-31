import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import settings

logger = logging.getLogger("hms.integrations.payments")


@dataclass
class PaymentOrder:
    order_id: str
    payment_link: str
    amount: float


class PaymentProvider(ABC):
    @abstractmethod
    def create_order(self, *, amount: float, patient_id: uuid.UUID, receipt: str) -> PaymentOrder: ...

    @abstractmethod
    def verify_webhook_signature(self, *, payload: bytes, signature: str) -> bool: ...


class MockPaymentProvider(PaymentProvider):
    """Fakes a Razorpay order + hosted payment link. No network calls, no keys required."""

    def create_order(self, *, amount: float, patient_id: uuid.UUID, receipt: str) -> PaymentOrder:
        order_id = f"mock_order_{uuid.uuid4().hex[:12]}"
        link = f"https://pay.mock.local/{order_id}"
        logger.info("MOCK PAYMENT: created order %s for patient %s amount %s", order_id, patient_id, amount)
        return PaymentOrder(order_id=order_id, payment_link=link, amount=amount)

    def verify_webhook_signature(self, *, payload: bytes, signature: str) -> bool:
        # Dev mode: accept the sentinel signature the mock webhook sender uses.
        return signature == "mock-signature"


class RazorpayPaymentProvider(PaymentProvider):
    """Real Razorpay integration. Requires `razorpay_key_id` / `razorpay_key_secret` in
    Settings. Not wired up (no `razorpay` SDK dependency yet) — swap `get_payment_provider`
    below to this once credentials are available and `pip install razorpay` is added."""

    def create_order(self, *, amount: float, patient_id: uuid.UUID, receipt: str) -> PaymentOrder:
        raise NotImplementedError("Add the razorpay SDK and real credentials to enable this provider")

    def verify_webhook_signature(self, *, payload: bytes, signature: str) -> bool:
        raise NotImplementedError("Add the razorpay SDK and real credentials to enable this provider")


def get_payment_provider() -> PaymentProvider:
    if settings.payment_provider == "razorpay":
        return RazorpayPaymentProvider()
    return MockPaymentProvider()
