"""Push delivery behind a swappable interface.

Firebase is plugged in by dropping the service-account JSON somewhere the
container can read it and setting ``FIREBASE_CREDENTIALS_FILE`` plus
``FCM_ENABLED=true``. Until then the logging backend runs, so every call site is
exercised in development without a key.

Two properties the rest of the code relies on:

* **Sending never raises.** A dead device or an unreachable FCM must not fail the
  request that triggered the notification — the in-app row is the durable record,
  push is the nudge on top of it.
* **The result names the tokens FCM rejected**, so the caller can prune them.
  Stale tokens accumulate fast (reinstalls, restores) and an unpruned list quietly
  turns into most of the send volume.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.core.config import settings

logger = logging.getLogger("push")

# FCM's own ceiling for a multicast batch.
MAX_BATCH = 500


@dataclass
class PushResult:
    sent: int = 0
    failed: int = 0
    invalid_tokens: list[str] = field(default_factory=list)

    def merge(self, other: PushResult) -> PushResult:
        return PushResult(
            sent=self.sent + other.sent,
            failed=self.failed + other.failed,
            invalid_tokens=[*self.invalid_tokens, *other.invalid_tokens],
        )


class PushBackend(ABC):
    @abstractmethod
    async def send(
        self, tokens: list[str], *, title: str, body: str, data: dict | None = None
    ) -> PushResult: ...


class LoggingPushBackend(PushBackend):
    """Writes the payload to the log instead of sending it. Default everywhere but production."""

    async def send(
        self, tokens: list[str], *, title: str, body: str, data: dict | None = None
    ) -> PushResult:
        logger.info(
            "[PUSH] to=%s title=%r body=%r data=%s", len(tokens), title, body, data or {}
        )
        return PushResult(sent=len(tokens))


class FCMPushBackend(PushBackend):
    """Firebase Cloud Messaging.

    ``firebase_admin`` is imported lazily and initialised once, so neither the
    dependency nor a credentials file is needed to run the rest of the app.
    """

    _app = None

    def _ensure_app(self):
        if FCMPushBackend._app is not None:
            return FCMPushBackend._app

        import firebase_admin
        from firebase_admin import credentials

        if not settings.firebase_credentials_file:
            raise RuntimeError("FIREBASE_CREDENTIALS_FILE is not configured.")

        cred = credentials.Certificate(settings.firebase_credentials_file)
        FCMPushBackend._app = firebase_admin.initialize_app(cred)
        return FCMPushBackend._app

    async def send(
        self, tokens: list[str], *, title: str, body: str, data: dict | None = None
    ) -> PushResult:
        if not tokens:
            return PushResult()

        import anyio
        from firebase_admin import messaging

        self._ensure_app()

        def _send_batch(batch: list[str]) -> PushResult:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(title=title, body=body),
                # FCM only accepts string values in the data payload.
                data={key: str(value) for key, value in (data or {}).items()},
                tokens=batch,
            )
            response = messaging.send_each_for_multicast(message)

            invalid: list[str] = []
            for token, result in zip(batch, response.responses, strict=True):
                if result.success:
                    continue
                error = result.exception
                # Only these two mean the token is gone for good; a transient
                # failure must not cost the user their registration.
                if isinstance(
                    error,
                    (
                        messaging.UnregisteredError,
                        messaging.SenderIdMismatchError,
                    ),
                ):
                    invalid.append(token)

            return PushResult(
                sent=response.success_count,
                failed=response.failure_count,
                invalid_tokens=invalid,
            )

        total = PushResult()
        for start in range(0, len(tokens), MAX_BATCH):
            batch = tokens[start : start + MAX_BATCH]
            # firebase-admin is synchronous; keep it off the event loop.
            total = total.merge(await anyio.to_thread.run_sync(_send_batch, batch))
        return total


def get_push_backend() -> PushBackend:
    if settings.fcm_enabled:
        return FCMPushBackend()
    return LoggingPushBackend()


async def safe_send(
    tokens: list[str], *, title: str, body: str, data: dict | None = None
) -> PushResult:
    """Send and swallow any transport failure. Never raises."""
    if not tokens:
        return PushResult()
    try:
        return await get_push_backend().send(tokens, title=title, body=body, data=data)
    except Exception:  # noqa: BLE001 - delivery is best-effort by design
        logger.exception("Push delivery failed for %s tokens", len(tokens))
        return PushResult(failed=len(tokens))
