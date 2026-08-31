import logging
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger("hms.integrations.sms")


class SmsProvider(ABC):
    @abstractmethod
    def send(self, *, to: str, message: str) -> None: ...


class MockSmsProvider(SmsProvider):
    """Logs the message instead of sending it. Sent messages are also visible via
    GET /api/admin/dev/sms-outbox for manual testing without a real SMS account."""

    outbox: list[dict] = []

    def send(self, *, to: str, message: str) -> None:
        logger.info("MOCK SMS to %s: %s", to, message)
        MockSmsProvider.outbox.append({"to": to, "message": message})


class TwilioSmsProvider(SmsProvider):
    """Real Twilio/MSG91 integration. Requires `twilio_account_sid` / `twilio_auth_token` /
    `twilio_from_number`. Not wired up (no `twilio` SDK dependency yet) — swap
    `get_sms_provider` below once credentials are available."""

    def send(self, *, to: str, message: str) -> None:
        raise NotImplementedError("Add the twilio SDK and real credentials to enable this provider")


def get_sms_provider() -> SmsProvider:
    if settings.sms_provider in ("twilio", "msg91"):
        return TwilioSmsProvider()
    return MockSmsProvider()
