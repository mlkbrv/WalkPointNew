"""Every push must carry the key the app routes a tap on.

Three senders exist and only one used to attach the notification type — and it
used a different key from the one the client reads. A tap could therefore only
ever open the inbox, whatever the notification was about. These pin the payload
so a fourth sender cannot quietly reintroduce the gap.
"""

from __future__ import annotations

import uuid

from app.models.enums import NotificationType
from app.services.notifications import push_payload


def test_the_routing_key_is_always_present():
    payload = push_payload(NotificationType.COINS_AWARDED)
    assert payload["notification_type"] == "coins_awarded"


def test_the_id_is_included_when_known():
    notification_id = uuid.uuid4()
    payload = push_payload(NotificationType.GENERIC, None, notification_id)
    assert payload["notification_id"] == str(notification_id)


def test_a_payload_without_an_id_omits_it_rather_than_sending_none():
    # FCM rejects non-string values, so a None would fail the whole send.
    assert "notification_id" not in push_payload(NotificationType.GENERIC)


def test_extra_data_travels_alongside():
    payload = push_payload(NotificationType.COINS_AWARDED, {"coins": 50})
    assert payload["coins"] == 50
    assert payload["notification_type"] == "coins_awarded"


def test_extra_data_cannot_overwrite_the_routing_key():
    """A stray field in `data` must not be able to break every tap."""
    payload = push_payload(NotificationType.SUPPORT_REPLY, {"notification_type": "nonsense"})
    assert payload["notification_type"] == "support_reply"
