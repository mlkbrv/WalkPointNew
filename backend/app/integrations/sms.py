"""SMS delivery behind a swappable interface.

The real provider is plugged in later: implement :class:`SMSBackend` and select it
with ``SMS_BACKEND`` in ``.env``. Nothing outside this module knows the provider.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger("sms")


class SMSBackend(ABC):
    @abstractmethod
    async def send(self, phone: str, message: str) -> None: ...


class MockSMSBackend(SMSBackend):
    """Logs the message instead of sending it. Default in local and test runs."""

    async def send(self, phone: str, message: str) -> None:
        logger.info("[MOCK SMS] to=%s message=%s", phone, message)


class TwilioSMSBackend(SMSBackend):
    """Placeholder wiring for Twilio. Credentials come from the environment."""

    async def send(self, phone: str, message: str) -> None:  # pragma: no cover - needs credentials
        if not (settings.twilio_account_sid and settings.twilio_auth_token):
            raise RuntimeError("Twilio credentials are not configured.")
        raise NotImplementedError("Plug in the Twilio REST client here.")


_BACKENDS: dict[str, type[SMSBackend]] = {
    "mock": MockSMSBackend,
    "twilio": TwilioSMSBackend,
}


def get_sms_backend() -> SMSBackend:
    backend_cls = _BACKENDS.get(settings.sms_backend, MockSMSBackend)
    return backend_cls()
