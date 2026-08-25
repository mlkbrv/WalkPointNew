"""The HTTP job trigger.

It exists for hosts where a second always-on process is not available, so the
things that matter are: it is off unless configured, it does not leak that it
exists, and the key cannot be brute-forced through a difference in responses.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.time import utcnow
from app.models.notification import Notification
from app.models.user import User

ROLLUP = "/v1/jobs/daily-rollup/run"


@pytest.fixture
def cron_key(monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "cron_secret", "test-cron-key")
    return "test-cron-key"


@pytest.fixture
def cron_disabled(monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "cron_secret", "")


async def test_the_endpoint_is_invisible_when_no_secret_is_set(client, cron_disabled):
    """404, not 403: an endpoint that says "locked" invites guessing at the key."""
    resp = await client.post(ROLLUP)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"

    # Same answer with a key, so the response cannot confirm the feature exists.
    with_key = await client.post(ROLLUP, headers={"X-Cron-Key": "anything"})
    assert with_key.status_code == 404


async def test_a_missing_key_is_refused(client, cron_key):
    resp = await client.post(ROLLUP)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CRON_KEY"


async def test_a_wrong_key_is_refused(client, cron_key):
    resp = await client.post(ROLLUP, headers={"X-Cron-Key": "not-the-key"})
    assert resp.status_code == 401


async def test_a_near_miss_key_is_refused(client, cron_key):
    """One character off is still wrong — no prefix matching."""
    resp = await client.post(ROLLUP, headers={"X-Cron-Key": "test-cron-ke"})
    assert resp.status_code == 401


async def test_the_rollup_runs_and_reports_what_it_did(client, db, cron_key):
    reg = await client.post(
        "/v1/auth/register", json={"email": "walker@example.com", "password": "correct-horse"}
    )
    headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}

    yesterday = (utcnow().date() - timedelta(days=1)).isoformat()
    await client.post(
        "/v1/steps/sync", json={"date": yesterday, "steps": 8_000}, headers=headers
    )

    resp = await client.post(
        f"{ROLLUP}?day={yesterday}", headers={"X-Cron-Key": cron_key}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["job"] == "daily-rollup"
    assert body["stats"]["processed"] == 1

    note = await db.scalar(select(Notification).where(Notification.title == "80 coins earned"))
    assert note is not None


async def test_running_the_rollup_twice_is_harmless(client, db, cron_key):
    reg = await client.post(
        "/v1/auth/register", json={"email": "twice@example.com", "password": "correct-horse"}
    )
    headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}

    yesterday = (utcnow().date() - timedelta(days=1)).isoformat()
    await client.post(
        "/v1/steps/sync", json={"date": yesterday, "steps": 9_000}, headers=headers
    )

    key = {"X-Cron-Key": cron_key}
    first = await client.post(f"{ROLLUP}?day={yesterday}", headers=key)
    second = await client.post(f"{ROLLUP}?day={yesterday}", headers=key)

    assert first.json()["stats"]["processed"] == 1
    assert second.json()["stats"]["processed"] == 0

    user = await db.scalar(select(User).where(User.email == "twice@example.com"))
    from app.services import economy

    assert await economy.get_balance(db, user.id) == 90


async def test_the_sweepers_run(client, cron_key):
    key = {"X-Cron-Key": cron_key}

    stories = await client.post("/v1/jobs/story-expiry/run", headers=key)
    vouchers = await client.post("/v1/jobs/voucher-expiry/run", headers=key)

    assert stories.json() == {"job": "story-expiry", "stats": {"expired": 0}}
    assert vouchers.json() == {"job": "voucher-expiry", "stats": {"expired": 0}}
