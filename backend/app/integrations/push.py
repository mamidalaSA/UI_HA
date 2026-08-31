import logging
import uuid
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger("hms.integrations.push")


class PushProvider(ABC):
    @abstractmethod
    def send(self, *, user_id: uuid.UUID, title: str, body: str, data: dict | None = None) -> None: ...


class MockPushProvider(PushProvider):
    """Logs the notification instead of sending it via FCM. Visible via
    GET /api/admin/dev/push-outbox for manual testing without Firebase credentials."""

    outbox: list[dict] = []

    def send(self, *, user_id: uuid.UUID, title: str, body: str, data: dict | None = None) -> None:
        logger.info("MOCK PUSH to %s: %s — %s", user_id, title, body)
        MockPushProvider.outbox.append(
            {"user_id": str(user_id), "title": title, "body": body, "data": data or {}}
        )


class FcmPushProvider(PushProvider):
    """Real Firebase Cloud Messaging integration. Requires `fcm_server_key`. Not wired up
    (no `firebase-admin` SDK dependency yet) — swap `get_push_provider` below once
    credentials are available."""

    def send(self, *, user_id: uuid.UUID, title: str, body: str, data: dict | None = None) -> None:
        raise NotImplementedError("Add the firebase-admin SDK and real credentials to enable this provider")


def get_push_provider() -> PushProvider:
    if settings.push_provider == "fcm":
        return FcmPushProvider()
    return MockPushProvider()
