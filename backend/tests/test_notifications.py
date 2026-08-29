"""The inbox, device registration, and push fan-out.

Push itself is stubbed: the logging backend runs, and the tests that care about
delivery capture the calls rather than reaching Firebase.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.time import utcnow
from app.integrations import push
from app.models.enums import NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import Device, User
from app.services import notifications as notifications_service
from app.workers.jobs import rollup_day

SYNC = "/v1/steps/sync"


@pytest.fixture
def sent(monkeypatch):
    """Capture every push the code attempts, without touching a backend."""
    calls: list[dict] = []

    async def _capture(tokens, *, title, body, data=None):
        calls.append({"tokens": list(tokens), "title": title, "body": body, "data": data or {}})
        return push.PushResult(sent=len(tokens))

    monkeypatch.setattr(push, "safe_send", _capture)
    return calls


async def consumer(client, email="walker@example.com"):
    resp = await client.post(
        "/v1/auth/register", json={"email": email, "password": "correct-horse"}
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def admin_headers(client, db, email="boss@example.com"):
    await client.post("/v1/auth/register", json={"email": email, "password": "correct-horse"})
    user = await db.scalar(select(User).where(User.email == email))
    user.role = UserRole.SUPERADMIN
    await db.commit()
    resp = await client.post(
        "/v1/auth/staff/login", json={"email": email, "password": "correct-horse"}
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def register_device(client, headers, token="fcm-token-1", device_id="device-1"):
    return await client.post(
        "/v1/notifications/push-token",
        json={"device_id": device_id, "push_token": token, "platform": "android"},
        headers=headers,
    )


# --- device registration ----------------------------------------------------


async def test_registering_a_push_token(client):
    headers = await consumer(client)

    resp = await register_device(client, headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["has_push_token"] is True
    assert resp.json()["platform"] == "android"

    devices = (await client.get("/v1/notifications/devices", headers=headers)).json()
    assert len(devices) == 1


async def test_re_registering_the_same_device_updates_in_place(client, db):
    headers = await consumer(client)
    await register_device(client, headers, token="old-token")
    await register_device(client, headers, token="new-token")

    rows = list((await db.scalars(select(Device))).all())
    assert len(rows) == 1
    assert rows[0].push_token == "new-token"


async def test_a_token_moves_to_its_new_owner(client, db):
    """A resold or shared handset must stop notifying the previous account."""
    first = await consumer(client, "first@example.com")
    second = await consumer(client, "second@example.com")

    await register_device(client, first, token="shared-token", device_id="handset")
    await register_device(client, second, token="shared-token", device_id="handset")

    rows = list((await db.scalars(select(Device))).all())
    holders = [row for row in rows if row.push_token == "shared-token"]
    assert len(holders) == 1


async def test_revoking_clears_the_token_but_keeps_the_device(client, db):
    headers = await consumer(client)
    await register_device(client, headers)

    resp = await client.post(
        "/v1/notifications/push-token/revoke",
        json={"device_id": "device-1"},
        headers=headers,
    )
    assert resp.status_code == 200

    devices = (await client.get("/v1/notifications/devices", headers=headers)).json()
    assert len(devices) == 1
    assert devices[0]["has_push_token"] is False


async def test_push_token_registration_requires_auth(client):
    resp = await client.post(
        "/v1/notifications/push-token",
        json={"device_id": "d", "push_token": "t"},
    )
    assert resp.status_code == 401


# --- the inbox --------------------------------------------------------------


async def test_the_inbox_is_empty_for_a_new_user(client):
    headers = await consumer(client)
    body = (await client.get("/v1/notifications", headers=headers)).json()
    assert body["items"] == []
    assert body["unread"] == 0


async def test_events_land_in_the_inbox(client, db):
    headers = await consumer(client)
    await client.post(
        SYNC, json={"date": utcnow().date().isoformat(), "steps": 45_000}, headers=headers
    )

    staff = await admin_headers(client, db)
    day_id = (await client.get("/v1/admin/steps/flagged", headers=staff)).json()[0]["day_id"]
    await client.post(f"/v1/admin/steps/flagged/{day_id}/approve", headers=staff)

    body = (await client.get("/v1/notifications", headers=headers)).json()
    assert body["unread"] == 1
    assert body["items"][0]["title"] == "Coins released"
    assert body["items"][0]["notification_type"] == NotificationType.COINS_AWARDED


async def test_marking_one_read(client, db):
    headers = await consumer(client)
    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    await notifications_service.notify(
        db, user_id=user.id, title="Hello", body="World", send_push=False
    )

    item = (await client.get("/v1/notifications", headers=headers)).json()["items"][0]
    read = await client.post(f"/v1/notifications/{item['id']}/read", headers=headers)

    assert read.json()["is_read"] is True
    assert read.json()["read_at"] is not None
    assert (await client.get("/v1/notifications/unread-count", headers=headers)).json() == {
        "unread": 0
    }


async def test_marking_all_read(client, db):
    headers = await consumer(client)
    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    for index in range(4):
        await notifications_service.notify(
            db, user_id=user.id, title=f"Note {index}", send_push=False
        )

    resp = await client.post("/v1/notifications/read-all", headers=headers)
    assert resp.json()["marked"] == 4
    assert (await client.post("/v1/notifications/read-all", headers=headers)).json() == {
        "marked": 0
    }


async def test_unread_only_filter(client, db):
    headers = await consumer(client)
    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    for index in range(3):
        await notifications_service.notify(
            db, user_id=user.id, title=f"Note {index}", send_push=False
        )

    first = (await client.get("/v1/notifications", headers=headers)).json()["items"][0]
    await client.post(f"/v1/notifications/{first['id']}/read", headers=headers)

    unread = (await client.get("/v1/notifications?unread_only=true", headers=headers)).json()
    assert len(unread["items"]) == 2


async def test_another_users_notification_cannot_be_marked_read(client, db):
    owner = await consumer(client, "owner@example.com")
    user = await db.scalar(select(User).where(User.email == "owner@example.com"))
    await notifications_service.notify(db, user_id=user.id, title="Private", send_push=False)
    item = (await client.get("/v1/notifications", headers=owner)).json()["items"][0]

    stranger = await consumer(client, "stranger@example.com")
    resp = await client.post(f"/v1/notifications/{item['id']}/read", headers=stranger)
    assert resp.status_code == 404


async def test_the_inbox_pages_without_repeating(client, db):
    headers = await consumer(client)
    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    for index in range(7):
        notifications_service.queue(db, user_id=user.id, title=f"Note {index}")
    await db.commit()

    first = (await client.get("/v1/notifications?limit=3", headers=headers)).json()
    assert len(first["items"]) == 3
    assert first["has_more"] is True

    second = (
        await client.get(
            f"/v1/notifications?limit=3&cursor={first['next_cursor']}", headers=headers
        )
    ).json()

    assert {item["id"] for item in first["items"]}.isdisjoint(
        {item["id"] for item in second["items"]}
    )


# --- push dispatch ----------------------------------------------------------


async def test_push_goes_to_the_registered_device(client, db, sent):
    headers = await consumer(client)
    await register_device(client, headers, token="target-token")

    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    await notifications_service.notify(db, user_id=user.id, title="Ping", body="Pong")

    assert len(sent) == 1
    assert sent[0]["tokens"] == ["target-token"]
    assert sent[0]["title"] == "Ping"
    # `notification_type`, not `type`: this is the key the app routes a tap on,
    # and it has to match what `routeForNotification` reads on the client.
    assert sent[0]["data"]["notification_type"] == NotificationType.GENERIC


async def test_a_user_without_a_device_still_gets_the_inbox_row(client, db, sent):
    headers = await consumer(client)
    user = await db.scalar(select(User).where(User.email == "walker@example.com"))

    await notifications_service.notify(db, user_id=user.id, title="Ping")

    # Nothing to push to, but the durable record exists.
    assert sent == [] or sent[0]["tokens"] == []
    assert len((await client.get("/v1/notifications", headers=headers)).json()["items"]) == 1


async def test_a_failing_push_does_not_break_the_request(client, db, monkeypatch):
    """Delivery is best-effort: a dead backend must not fail the caller."""
    headers = await consumer(client)
    await register_device(client, headers, token="doomed")

    class Exploding(push.PushBackend):
        async def send(self, tokens, *, title, body, data=None):
            raise RuntimeError("FCM is down")

    monkeypatch.setattr(push, "get_push_backend", lambda: Exploding())

    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    result = await notifications_service.notify(db, user_id=user.id, title="Ping")

    assert result.id is not None
    assert len((await client.get("/v1/notifications", headers=headers)).json()["items"]) == 1


async def test_tokens_rejected_by_fcm_are_pruned(client, db, monkeypatch):
    headers = await consumer(client)
    await register_device(client, headers, token="stale-token")

    class Rejecting(push.PushBackend):
        async def send(self, tokens, *, title, body, data=None):
            return push.PushResult(failed=len(tokens), invalid_tokens=list(tokens))

    monkeypatch.setattr(push, "get_push_backend", lambda: Rejecting())

    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    await notifications_service.notify(db, user_id=user.id, title="Ping")

    devices = (await client.get("/v1/notifications/devices", headers=headers)).json()
    assert devices[0]["has_push_token"] is False


async def test_the_rollup_sends_one_multicast_per_distinct_message(client, db, sent):
    """Thousands of identical messages must not become thousands of sends."""
    yesterday = utcnow().date() - timedelta(days=1)

    for index in range(3):
        headers = await consumer(client, f"walker{index}@example.com")
        await register_device(
            client, headers, token=f"token-{index}", device_id=f"device-{index}"
        )
        # Same step count, so the roll-up message is identical for all three.
        await client.post(
            SYNC, json={"date": yesterday.isoformat(), "steps": 8_000}, headers=headers
        )

    sent.clear()
    stats = await rollup_day(db, yesterday)

    assert stats["processed"] == 3
    assert len(sent) == 1
    assert sorted(sent[0]["tokens"]) == ["token-0", "token-1", "token-2"]


async def test_the_rollup_separates_earned_from_missed(client, db, sent):
    yesterday = utcnow().date() - timedelta(days=1)

    earner = await consumer(client, "earner@example.com")
    await register_device(client, earner, token="earner-token", device_id="d1")
    await client.post(
        SYNC, json={"date": yesterday.isoformat(), "steps": 8_000}, headers=earner
    )

    slacker = await consumer(client, "slacker@example.com")
    await register_device(client, slacker, token="slacker-token", device_id="d2")
    await client.post(
        SYNC, json={"date": yesterday.isoformat(), "steps": 2_000}, headers=slacker
    )

    sent.clear()
    await rollup_day(db, yesterday)

    titles = {call["title"]: call["tokens"] for call in sent}
    assert titles["80 coins earned"] == ["earner-token"]
    assert titles["No coins today"] == ["slacker-token"]


# --- moderation results -----------------------------------------------------


async def test_the_partner_is_told_when_their_business_is_approved(client, db):
    reg = await client.post(
        "/v1/partners/register",
        json={
            "email": "cafe@example.com",
            "password": "correct-horse",
            "company_name": "Bean There",
        },
    )
    partner_headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}
    staff = await admin_headers(client, db)

    await client.post(
        f"/v1/admin/partners/{reg.json()['partner']['id']}/approve", headers=staff
    )

    inbox = (await client.get("/v1/notifications", headers=partner_headers)).json()
    assert inbox["items"][0]["title"] == "Your business is approved"
    assert inbox["items"][0]["notification_type"] == NotificationType.MODERATION_RESULT


async def test_the_partner_is_told_why_a_coupon_was_rejected(client, db):
    reg = await client.post(
        "/v1/partners/register",
        json={
            "email": "cafe@example.com",
            "password": "correct-horse",
            "company_name": "Bean There",
        },
    )
    partner_headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}
    staff = await admin_headers(client, db)
    await client.post(
        f"/v1/admin/partners/{reg.json()['partner']['id']}/approve", headers=staff
    )

    coupon = (
        await client.post(
            "/v1/business/coupons",
            json={
                "title": "Free coffee",
                "cost_coins": 100,
                "quantity_total": 5,
                "starts_at": (utcnow() - timedelta(hours=1)).isoformat(),
                "ends_at": (utcnow() + timedelta(days=7)).isoformat(),
            },
            headers=partner_headers,
        )
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=partner_headers)
    await client.post(
        f"/v1/admin/coupons/{coupon['id']}/reject",
        json={"reason": "The photo is unreadable."},
        headers=staff,
    )

    inbox = (await client.get("/v1/notifications", headers=partner_headers)).json()
    latest = inbox["items"][0]
    assert latest["title"] == "Coupon needs changes"
    assert "unreadable" in latest["body"]


async def test_approving_a_coupon_announces_it_to_consumers(client, db, sent):
    walker = await consumer(client, "shopper@example.com")
    await register_device(client, walker, token="shopper-token")

    reg = await client.post(
        "/v1/partners/register",
        json={
            "email": "cafe@example.com",
            "password": "correct-horse",
            "company_name": "Bean There",
        },
    )
    partner_headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}
    staff = await admin_headers(client, db)
    await client.post(
        f"/v1/admin/partners/{reg.json()['partner']['id']}/approve", headers=staff
    )

    coupon = (
        await client.post(
            "/v1/business/coupons",
            json={
                "title": "Free coffee",
                "cost_coins": 100,
                "quantity_total": 5,
                "starts_at": (utcnow() - timedelta(hours=1)).isoformat(),
                "ends_at": (utcnow() + timedelta(days=7)).isoformat(),
            },
            headers=partner_headers,
        )
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=partner_headers)

    sent.clear()
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    announcements = [call for call in sent if call["title"].startswith("New offer")]
    assert len(announcements) == 1
    assert announcements[0]["tokens"] == ["shopper-token"]

    # Push-only: the announcement must not fill every consumer's inbox.
    rows = list(
        (
            await db.scalars(
                select(Notification).where(Notification.title.like("New offer%"))
            )
        ).all()
    )
    assert rows == []


# --- broadcast --------------------------------------------------------------


async def test_admin_broadcast_reaches_every_active_user(client, db, sent):
    first = await consumer(client, "one@example.com")
    await register_device(client, first, token="token-one", device_id="d1")
    second = await consumer(client, "two@example.com")
    await register_device(client, second, token="token-two", device_id="d2")
    staff = await admin_headers(client, db)

    sent.clear()
    resp = await client.post(
        "/v1/admin/notifications/broadcast",
        json={"title": "Scheduled maintenance", "body": "Back at 03:00."},
        headers=staff,
    )
    assert resp.status_code == 200
    assert resp.json()["recipients"] == 3  # two walkers plus the admin account

    assert len(sent) == 1
    assert sorted(sent[0]["tokens"]) == ["token-one", "token-two"]

    inbox = (await client.get("/v1/notifications", headers=first)).json()
    assert inbox["items"][0]["title"] == "Scheduled maintenance"


async def test_broadcast_can_target_one_role(client, db):
    await consumer(client, "walker@example.com")
    reg = await client.post(
        "/v1/partners/register",
        json={
            "email": "cafe@example.com",
            "password": "correct-horse",
            "company_name": "Bean There",
        },
    )
    partner_headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}
    staff = await admin_headers(client, db)

    resp = await client.post(
        "/v1/admin/notifications/broadcast",
        json={"title": "Partner update", "body": "New rules apply.", "role": "partner"},
        headers=staff,
    )
    assert resp.json()["recipients"] == 1

    inbox = (await client.get("/v1/notifications", headers=partner_headers)).json()
    assert inbox["items"][0]["title"] == "Partner update"


async def test_a_consumer_cannot_broadcast(client):
    headers = await consumer(client)
    resp = await client.post(
        "/v1/admin/notifications/broadcast",
        json={"title": "Spam", "body": "Buy this."},
        headers=headers,
    )
    assert resp.status_code == 403


async def test_a_blocked_user_is_left_out_of_a_broadcast(client, db):
    await consumer(client, "blocked@example.com")
    blocked = await db.scalar(select(User).where(User.email == "blocked@example.com"))
    blocked.is_blocked = True
    await db.commit()

    staff = await admin_headers(client, db)
    resp = await client.post(
        "/v1/admin/notifications/broadcast",
        json={"title": "News", "body": "Hello."},
        headers=staff,
    )
    assert resp.json()["recipients"] == 1  # only the admin

    rows = list(
        (
            await db.scalars(
                select(Notification).where(Notification.user_id == blocked.id)
            )
        ).all()
    )
    assert rows == []


# --- purchase and redemption events -----------------------------------------


async def test_purchase_and_redemption_push_to_the_buyer(client, db, sent):
    reg = await client.post(
        "/v1/partners/register",
        json={
            "email": "cafe@example.com",
            "password": "correct-horse",
            "company_name": "Bean There",
        },
    )
    partner_headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}
    staff = await admin_headers(client, db)
    await client.post(
        f"/v1/admin/partners/{reg.json()['partner']['id']}/approve", headers=staff
    )
    coupon = (
        await client.post(
            "/v1/business/coupons",
            json={
                "title": "Free coffee",
                "cost_coins": 100,
                "quantity_total": 5,
                "starts_at": (utcnow() - timedelta(hours=1)).isoformat(),
                "ends_at": (utcnow() + timedelta(days=7)).isoformat(),
            },
            headers=partner_headers,
        )
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=partner_headers)
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    walker = await consumer(client, "buyer@example.com")
    await register_device(client, walker, token="buyer-token")
    await client.post(
        SYNC, json={"date": utcnow().date().isoformat(), "steps": 15_000}, headers=walker
    )

    sent.clear()
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]
    await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=partner_headers
    )

    titles = [call["title"] for call in sent if call["tokens"] == ["buyer-token"]]
    assert "Coupon added to your wallet" in titles
    assert "Coupon redeemed" in titles


async def test_notification_data_carries_the_deep_link_ids(client, db):
    headers = await consumer(client)
    user = await db.scalar(select(User).where(User.email == "walker@example.com"))
    await notifications_service.notify(
        db,
        user_id=user.id,
        title="Look",
        data={"coupon_id": str(uuid.uuid4())},
        send_push=False,
    )

    item = (await client.get("/v1/notifications", headers=headers)).json()["items"][0]
    assert "coupon_id" in item["data"]
