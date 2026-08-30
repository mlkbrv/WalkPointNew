"""The reward curve, sync idempotency, anti-fraud withholding, and the roll-up.

These are the tests that must never be relaxed: they encode the money rules.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.time import utcnow
from app.models.audit import FlaggedEvent
from app.models.economy import CoinTransaction, DailySteps, EconomySettings
from app.models.enums import CoinSource, FlagStatus, NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import User
from app.services import economy
from app.workers.jobs import rollup_day

SYNC = "/v1/steps/sync"


async def auth_headers(client, email="walker@example.com"):
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


def today_iso() -> str:
    return utcnow().date().isoformat()


# --- the reward curve -------------------------------------------------------


@pytest.mark.parametrize(
    ("steps", "expected"),
    [
        (0, 0),
        (4_999, 0),  # one step short pays nothing at all
        (5_000, 50),  # exactly the threshold pays the flat reward
        (5_999, 50),  # partial thousands do not round up
        (6_000, 60),
        (7_000, 70),
        (15_000, 150),
        (60_000, 500),  # capped at hard_cap_steps_per_day (50k)
    ],
)
def test_reward_curve(steps, expected):
    econ = EconomySettings(
        minimum_steps_threshold=5_000,
        reward_at_threshold=50,
        reward_per_extra_thousand_steps=10,
        hard_cap_steps_per_day=50_000,
    )
    assert economy.compute_steps_reward(steps, econ) == expected


# --- sync -------------------------------------------------------------------


async def test_below_threshold_awards_nothing(client):
    headers = await auth_headers(client)

    resp = await client.post(SYNC, json={"date": today_iso(), "steps": 4_999}, headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["coins_awarded"] == 0
    assert body["balance"] == 0


async def test_threshold_awards_the_flat_reward(client):
    headers = await auth_headers(client)

    body = (
        await client.post(SYNC, json={"date": today_iso(), "steps": 5_000}, headers=headers)
    ).json()
    assert body["coins_awarded"] == 50
    assert body["balance"] == 50


async def test_resyncing_the_same_total_pays_nothing_extra(client):
    headers = await auth_headers(client)
    payload = {"date": today_iso(), "steps": 5_000}

    first = (await client.post(SYNC, json=payload, headers=headers)).json()
    second = (await client.post(SYNC, json=payload, headers=headers)).json()
    third = (await client.post(SYNC, json=payload, headers=headers)).json()

    assert first["coins_awarded"] == 50
    assert second["coins_awarded"] == 0
    assert third["coins_awarded"] == 0
    assert third["balance"] == 50


async def test_a_later_sync_pays_only_the_delta(client):
    headers = await auth_headers(client)

    await client.post(SYNC, json={"date": today_iso(), "steps": 5_000}, headers=headers)
    later = (
        await client.post(SYNC, json={"date": today_iso(), "steps": 7_000}, headers=headers)
    ).json()

    assert later["coins_awarded"] == 20  # 70 earned - 50 already paid
    assert later["balance"] == 70


async def test_a_lower_total_is_ignored(client):
    headers = await auth_headers(client)

    await client.post(SYNC, json={"date": today_iso(), "steps": 7_000}, headers=headers)
    regressed = (
        await client.post(SYNC, json={"date": today_iso(), "steps": 3_000}, headers=headers)
    ).json()

    assert regressed["coins_awarded"] == 0
    assert regressed["balance"] == 70
    assert regressed["day"]["steps"] == 7_000


async def test_future_dates_are_rejected(client):
    headers = await auth_headers(client)
    tomorrow = (utcnow().date() + timedelta(days=1)).isoformat()

    resp = await client.post(SYNC, json={"date": tomorrow, "steps": 6_000}, headers=headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "FUTURE_DATE"


async def test_stale_dates_are_rejected(client):
    headers = await auth_headers(client)
    stale = (utcnow().date() - timedelta(days=10)).isoformat()

    resp = await client.post(SYNC, json={"date": stale, "steps": 6_000}, headers=headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "SYNC_TOO_OLD"


async def test_sync_requires_authentication(client):
    assert (await client.post(SYNC, json={"date": today_iso(), "steps": 6_000})).status_code == 401


# --- anti-fraud -------------------------------------------------------------


async def test_implausible_day_is_flagged_and_withheld(client, db):
    headers = await auth_headers(client)

    body = (
        await client.post(SYNC, json={"date": today_iso(), "steps": 45_000}, headers=headers)
    ).json()

    assert body["is_suspicious"] is True
    assert body["coins_awarded"] == 0
    assert body["balance"] == 0
    assert "plausibility" in body["reason"]

    # The steps are still recorded, and a flag is queued for a human.
    day = await db.scalar(select(DailySteps).where(DailySteps.steps == 45_000))
    assert day.is_suspicious is True
    flag = await db.scalar(select(FlaggedEvent).where(FlaggedEvent.target_id == day.id))
    assert flag.status == FlagStatus.OPEN


async def test_a_flagged_user_is_not_blocked(client):
    """Flagging withholds coins; it must never lock the account out of the API."""
    headers = await auth_headers(client)
    await client.post(SYNC, json={"date": today_iso(), "steps": 45_000}, headers=headers)

    assert (await client.get("/v1/auth/me", headers=headers)).status_code == 200
    assert (await client.get("/v1/wallet", headers=headers)).status_code == 200


async def test_a_flagged_day_stays_withheld_on_the_next_sync(client):
    headers = await auth_headers(client)
    await client.post(SYNC, json={"date": today_iso(), "steps": 45_000}, headers=headers)

    # A plausible-looking follow-up must not sneak the day past review.
    body = (
        await client.post(SYNC, json={"date": today_iso(), "steps": 46_000}, headers=headers)
    ).json()
    assert body["coins_awarded"] == 0
    assert body["balance"] == 0


async def test_absurd_counts_are_refused_outright(client):
    headers = await auth_headers(client)

    resp = await client.post(SYNC, json={"date": today_iso(), "steps": 150_000}, headers=headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "STEP_CAP_EXCEEDED"


async def test_step_spike_within_a_burst_is_flagged(client):
    headers = await auth_headers(client)

    await client.post(SYNC, json={"date": today_iso(), "steps": 6_000}, headers=headers)
    # 20k more steps seconds later implies an impossible pace.
    body = (
        await client.post(SYNC, json={"date": today_iso(), "steps": 26_000}, headers=headers)
    ).json()

    assert body["is_suspicious"] is True
    assert body["coins_awarded"] == 0
    assert body["balance"] == 60  # the honest first sync keeps what it earned


# --- review -----------------------------------------------------------------


async def test_admin_releases_a_flagged_day(client, db):
    walker = await auth_headers(client, "flagged@example.com")
    await client.post(SYNC, json={"date": today_iso(), "steps": 45_000}, headers=walker)

    staff = await admin_headers(client, db)
    queue = (await client.get("/v1/admin/steps/flagged", headers=staff)).json()
    assert len(queue) == 1
    assert queue[0]["coins_pending"] == 450

    day_id = queue[0]["day_id"]
    released = await client.post(f"/v1/admin/steps/flagged/{day_id}/approve", headers=staff)
    assert released.status_code == 200
    assert released.json()["coins_awarded"] == 450

    wallet = (await client.get("/v1/wallet", headers=walker)).json()
    assert wallet["balance"] == 450


async def test_admin_rejects_a_flagged_day_and_it_leaves_the_queue(client, db):
    walker = await auth_headers(client, "cheater@example.com")
    await client.post(SYNC, json={"date": today_iso(), "steps": 45_000}, headers=walker)

    staff = await admin_headers(client, db)
    day_id = (await client.get("/v1/admin/steps/flagged", headers=staff)).json()[0]["day_id"]

    resp = await client.post(
        f"/v1/admin/steps/flagged/{day_id}/reject",
        json={"reason": "Impossible for this account."},
        headers=staff,
    )
    assert resp.status_code == 200

    assert (await client.get("/v1/admin/steps/flagged", headers=staff)).json() == []
    assert (await client.get("/v1/wallet", headers=walker)).json()["balance"] == 0


async def test_a_rejected_day_cannot_be_paid_by_a_later_sync(client, db):
    walker = await auth_headers(client, "persistent@example.com")
    await client.post(SYNC, json={"date": today_iso(), "steps": 45_000}, headers=walker)

    staff = await admin_headers(client, db)
    day_id = (await client.get("/v1/admin/steps/flagged", headers=staff)).json()[0]["day_id"]
    await client.post(
        f"/v1/admin/steps/flagged/{day_id}/reject", json={"reason": "no"}, headers=staff
    )

    await client.post(SYNC, json={"date": today_iso(), "steps": 46_000}, headers=walker)
    assert (await client.get("/v1/wallet", headers=walker)).json()["balance"] == 0


async def test_releasing_an_unflagged_day_is_refused(client, db):
    walker = await auth_headers(client, "clean@example.com")
    await client.post(SYNC, json={"date": today_iso(), "steps": 6_000}, headers=walker)
    day = await db.scalar(select(DailySteps).where(DailySteps.steps == 6_000))

    staff = await admin_headers(client, db)
    resp = await client.post(f"/v1/admin/steps/flagged/{day.id}/approve", headers=staff)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NOT_FLAGGED"


async def test_a_consumer_cannot_reach_the_review_queue(client):
    headers = await auth_headers(client)
    assert (await client.get("/v1/admin/steps/flagged", headers=headers)).status_code == 403


# --- wallet -----------------------------------------------------------------


async def test_wallet_reports_earned_and_spent_from_the_ledger(client, db):
    headers = await auth_headers(client, "spender@example.com")
    await client.post(SYNC, json={"date": today_iso(), "steps": 10_000}, headers=headers)

    user = await db.scalar(select(User).where(User.email == "spender@example.com"))
    db.add(
        CoinTransaction(
            user_id=user.id, amount=-40, source=CoinSource.COUPON_PURCHASE, note="test spend"
        )
    )
    await db.commit()

    wallet = (await client.get("/v1/wallet", headers=headers)).json()
    assert wallet["earned_total"] == 100
    assert wallet["spent_total"] == 40
    assert wallet["balance"] == 60


async def test_ledger_pages_without_repeating_entries(client, db):
    headers = await auth_headers(client, "ledger@example.com")
    user = await db.scalar(select(User).where(User.email == "ledger@example.com"))
    for index in range(7):
        db.add(
            CoinTransaction(
                user_id=user.id, amount=index + 1, source=CoinSource.ADMIN_ADJUST, note=str(index)
            )
        )
    await db.commit()

    first = (await client.get("/v1/wallet/ledger?limit=3", headers=headers)).json()
    assert len(first["items"]) == 3
    assert first["has_more"] is True

    second = (
        await client.get(
            f"/v1/wallet/ledger?limit=3&cursor={first['next_cursor']}", headers=headers
        )
    ).json()

    first_ids = {item["id"] for item in first["items"]}
    second_ids = {item["id"] for item in second["items"]}
    assert first_ids.isdisjoint(second_ids)


async def test_ledger_rejects_a_malformed_cursor(client):
    headers = await auth_headers(client)
    resp = await client.get("/v1/wallet/ledger?cursor=not-a-cursor", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "BAD_CURSOR"


# --- nightly roll-up --------------------------------------------------------


async def test_rollup_settles_and_announces_an_earning_day(client, db):
    headers = await auth_headers(client, "rollup@example.com")
    yesterday = (utcnow().date() - timedelta(days=1)).isoformat()
    await client.post(SYNC, json={"date": yesterday, "steps": 8_000}, headers=headers)

    stats = await rollup_day(db, utcnow().date() - timedelta(days=1))

    assert stats["processed"] == 1
    assert stats["coins"] == 0  # the sync already paid it; nothing outstanding
    note = await db.scalar(
        select(Notification).where(Notification.notification_type == NotificationType.COINS_AWARDED)
    )
    assert "80 coins earned" == note.title


async def test_rollup_tells_the_user_when_they_fell_short(client, db):
    headers = await auth_headers(client, "short@example.com")
    yesterday = (utcnow().date() - timedelta(days=1)).isoformat()
    await client.post(SYNC, json={"date": yesterday, "steps": 3_200}, headers=headers)

    stats = await rollup_day(db, utcnow().date() - timedelta(days=1))

    assert stats["below_threshold"] == 1
    note = await db.scalar(
        select(Notification).where(Notification.notification_type == NotificationType.STEPS_MISSED)
    )
    assert "1,800 short" in note.body


async def test_rollup_pays_a_day_the_sync_never_settled(client, db):
    """The safety net: a day whose ledger entry never landed still gets paid once."""
    headers = await auth_headers(client, "unsettled@example.com")
    user = await db.scalar(select(User).where(User.email == "unsettled@example.com"))
    yesterday = utcnow().date() - timedelta(days=1)

    db.add(DailySteps(user_id=user.id, date=yesterday, steps=9_000, coins_awarded=0))
    await db.commit()

    stats = await rollup_day(db, yesterday)
    assert stats["coins"] == 90
    assert (await client.get("/v1/wallet", headers=headers)).json()["balance"] == 90


async def test_rollup_is_idempotent(client, db):
    headers = await auth_headers(client, "twice@example.com")
    user = await db.scalar(select(User).where(User.email == "twice@example.com"))
    yesterday = utcnow().date() - timedelta(days=1)

    db.add(DailySteps(user_id=user.id, date=yesterday, steps=9_000, coins_awarded=0))
    await db.commit()

    await rollup_day(db, yesterday)
    second = await rollup_day(db, yesterday)

    assert second["processed"] == 0
    assert (await client.get("/v1/wallet", headers=headers)).json()["balance"] == 90


async def test_rollup_leaves_flagged_days_to_the_reviewer(client, db):
    headers = await auth_headers(client, "underreview@example.com")
    yesterday = (utcnow().date() - timedelta(days=1)).isoformat()
    await client.post(SYNC, json={"date": yesterday, "steps": 45_000}, headers=headers)

    stats = await rollup_day(db, utcnow().date() - timedelta(days=1))

    assert stats["withheld"] == 1
    assert stats["coins"] == 0
    assert (await client.get("/v1/wallet", headers=headers)).json()["balance"] == 0


# --- economy settings -------------------------------------------------------


async def test_admin_can_retune_the_threshold_without_a_deploy(client, db):
    staff = await admin_headers(client, db)

    resp = await client.patch(
        "/v1/admin/economy",
        json={"minimum_steps_threshold": 3_000, "reward_at_threshold": 25},
        headers=staff,
    )
    assert resp.status_code == 200
    assert resp.json()["minimum_steps_threshold"] == 3_000

    walker = await auth_headers(client, "retuned@example.com")
    body = (
        await client.post(SYNC, json={"date": today_iso(), "steps": 3_000}, headers=walker)
    ).json()
    assert body["coins_awarded"] == 25


async def test_the_hard_cap_cannot_drop_below_the_suspicion_threshold(client, db):
    staff = await admin_headers(client, db)

    resp = await client.patch(
        "/v1/admin/economy", json={"hard_cap_steps_per_day": 10_000}, headers=staff
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_LIMITS"


async def test_admin_adjustment_appends_to_the_ledger(client, db):
    walker = await auth_headers(client, "adjusted@example.com")
    user = await db.scalar(select(User).where(User.email == "adjusted@example.com"))
    staff = await admin_headers(client, db)

    resp = await client.post(
        "/v1/admin/ledger/adjust",
        json={"user_id": str(user.id), "amount": 500, "note": "Goodwill"},
        headers=staff,
    )
    assert resp.status_code == 200
    assert resp.json()["balance"] == 500
    assert (await client.get("/v1/wallet", headers=walker)).json()["balance"] == 500


async def test_steps_rules_are_served_to_the_app(client):
    headers = await auth_headers(client)
    rules = (await client.get("/v1/steps/rules", headers=headers)).json()
    assert rules["minimum_steps_threshold"] == 5_000
    assert rules["reward_at_threshold"] == 50


async def test_an_invented_source_is_refused(client):
    """`source` was free text defaulting to "health_connect", so the column
    filled with a claim nobody had made. It is an enum now."""
    headers = await auth_headers(client, "sourcecheck@example.com")
    resp = await client.post(
        "/v1/steps/sync",
        json={"date": utcnow().date().isoformat(), "steps": 6000, "source": "vibes"},
        headers=headers,
    )
    assert resp.status_code == 400


async def test_an_unstated_source_records_as_unknown(client):
    """Better an honest gap than a plausible guess."""
    headers = await auth_headers(client, "nosource@example.com")
    await client.post(
        "/v1/steps/sync",
        json={"date": utcnow().date().isoformat(), "steps": 6000},
        headers=headers,
    )
    today = (await client.get("/v1/steps/today", headers=headers)).json()
    assert today["source"] == "unknown"


async def test_the_foreground_fallback_is_recorded_as_such(client):
    """An operator has to be able to tell a background-counted day from one that
    only accumulated while the app was open."""
    headers = await auth_headers(client, "fallback@example.com")
    await client.post(
        "/v1/steps/sync",
        json={
            "date": utcnow().date().isoformat(),
            "steps": 6000,
            "source": "pedometer_foreground",
        },
        headers=headers,
    )
    today = (await client.get("/v1/steps/today", headers=headers)).json()
    assert today["source"] == "pedometer_foreground"
