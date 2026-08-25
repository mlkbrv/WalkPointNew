"""Partner onboarding, the moderation lifecycle, and consumer visibility.

The rule these tests defend: nothing a partner writes reaches a consumer until a
superadmin has approved both the business and the item.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select

from app.core.time import as_aware, utcnow
from app.models.enums import UserRole
from app.models.story import Story
from app.models.user import User
from app.services import stories as stories_service


def coupon_payload(**overrides) -> dict:
    body = {
        "title": "Free coffee",
        "description": "One large coffee on us.",
        "cost_coins": 100,
        "quantity_total": 50,
        "starts_at": (utcnow() - timedelta(hours=1)).isoformat(),
        "ends_at": (utcnow() + timedelta(days=30)).isoformat(),
    }
    body.update(overrides)
    return body


async def register_partner(client, email="cafe@example.com", company="Bean There"):
    resp = await client.post(
        "/v1/partners/register",
        json={"email": email, "password": "correct-horse", "company_name": company},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {"Authorization": f"Bearer {body['tokens']['access_token']}"}, body["partner"]


async def admin_headers(client, db, email="boss@example.com"):
    await client.post("/v1/auth/register", json={"email": email, "password": "correct-horse"})
    user = await db.scalar(select(User).where(User.email == email))
    user.role = UserRole.SUPERADMIN
    await db.commit()
    resp = await client.post(
        "/v1/auth/staff/login", json={"email": email, "password": "correct-horse"}
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def consumer_headers(client, email="walker@example.com"):
    resp = await client.post(
        "/v1/auth/register", json={"email": email, "password": "correct-horse"}
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def approved_partner(client, db, email="approved@example.com", company="Approved Co"):
    headers, partner = await register_partner(client, email, company)
    staff = await admin_headers(client, db)
    await client.post(f"/v1/admin/partners/{partner['id']}/approve", headers=staff)
    return headers, partner, staff


# --- onboarding -------------------------------------------------------------


async def test_partner_registration_creates_a_pending_business(client):
    headers, partner = await register_partner(client)

    assert partner["status"] == "pending"
    assert partner["company_name"] == "Bean There"

    profile = (await client.get("/v1/business/profile", headers=headers)).json()
    assert profile["status"] == "pending"


async def test_a_pending_business_is_not_in_the_public_store_list(client):
    await register_partner(client)
    assert (await client.get("/v1/partners")).json() == []


async def test_an_approved_business_appears_publicly(client, db):
    _, partner, _ = await approved_partner(client, db)

    stores = (await client.get("/v1/partners")).json()
    assert [store["id"] for store in stores] == [partner["id"]]


async def test_rejection_requires_a_reason(client, db):
    _, partner = await register_partner(client)
    staff = await admin_headers(client, db)

    resp = await client.post(
        f"/v1/admin/partners/{partner['id']}/reject", json={"reason": "  "}, headers=staff
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "REASON_REQUIRED"


async def test_a_consumer_cannot_reach_the_partner_console(client):
    headers = await consumer_headers(client)
    assert (await client.get("/v1/business/profile", headers=headers)).status_code == 403


async def test_partner_registration_rejects_a_taken_email(client):
    await register_partner(client)
    resp = await client.post(
        "/v1/partners/register",
        json={"email": "cafe@example.com", "password": "correct-horse", "company_name": "Other"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_TAKEN"


# --- coupon lifecycle -------------------------------------------------------


async def test_an_unapproved_business_cannot_submit_a_coupon(client):
    headers, _ = await register_partner(client)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()

    resp = await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "PARTNER_NOT_APPROVED"


async def test_a_draft_coupon_is_invisible_to_consumers(client, db):
    headers, _, _ = await approved_partner(client, db)
    await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)

    assert (await client.get("/v1/coupons")).json() == []


async def test_a_pending_coupon_is_still_invisible(client, db):
    headers, _, _ = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)

    assert (await client.get("/v1/coupons")).json() == []
    detail = await client.get(f"/v1/coupons/{coupon['id']}")
    assert detail.status_code == 422
    assert detail.json()["error"]["code"] == "NOT_APPROVED"


async def test_approval_puts_the_coupon_in_the_catalogue(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)

    queue = (await client.get("/v1/admin/coupons/pending", headers=staff)).json()
    assert len(queue) == 1

    approved = await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    catalogue = (await client.get("/v1/coupons")).json()
    assert [item["id"] for item in catalogue] == [coupon["id"]]
    assert catalogue[0]["quantity_remaining"] == 50
    # The consumer view must not leak moderation internals.
    assert "rejection_reason" not in catalogue[0]


async def test_rejection_returns_the_reason_to_the_partner(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)

    await client.post(
        f"/v1/admin/coupons/{coupon['id']}/reject",
        json={"reason": "The photo is unreadable."},
        headers=staff,
    )

    mine = (await client.get(f"/v1/business/coupons/{coupon['id']}", headers=headers)).json()
    assert mine["status"] == "rejected"
    assert mine["rejection_reason"] == "The photo is unreadable."


async def test_a_rejected_coupon_can_be_fixed_and_resubmitted(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    await client.post(
        f"/v1/admin/coupons/{coupon['id']}/reject", json={"reason": "Fix it."}, headers=staff
    )

    patched = await client.patch(
        f"/v1/business/coupons/{coupon['id']}", json={"title": "Fixed title"}, headers=headers
    )
    assert patched.status_code == 200

    resubmitted = await client.post(
        f"/v1/business/coupons/{coupon['id']}/submit", headers=headers
    )
    assert resubmitted.json()["status"] == "pending"
    assert resubmitted.json()["rejection_reason"] == ""


async def test_a_pending_coupon_cannot_be_edited(client, db):
    headers, _, _ = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)

    resp = await client.patch(
        f"/v1/business/coupons/{coupon['id']}", json={"cost_coins": 1}, headers=headers
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "UNDER_REVIEW"


async def test_an_approved_coupon_cannot_be_edited_without_withdrawing(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    blocked = await client.patch(
        f"/v1/business/coupons/{coupon['id']}", json={"cost_coins": 1}, headers=headers
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "ALREADY_APPROVED"

    await client.post(f"/v1/business/coupons/{coupon['id']}/withdraw", headers=headers)
    assert (
        await client.patch(
            f"/v1/business/coupons/{coupon['id']}", json={"cost_coins": 1}, headers=headers
        )
    ).status_code == 200
    # Withdrawing also pulls it out of the catalogue.
    assert (await client.get("/v1/coupons")).json() == []


async def test_a_partner_cannot_approve_their_own_coupon(client, db):
    headers, _, _ = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)

    resp = await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=headers)
    assert resp.status_code == 403


async def test_only_pending_coupons_can_be_approved(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()

    resp = await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NOT_PENDING"


async def test_a_partner_cannot_read_another_partners_coupon(client, db):
    first, _, _ = await approved_partner(client, db, "one@example.com", "One")
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=first)
    ).json()

    second, _ = await register_partner(client, "two@example.com", "Two")
    resp = await client.get(f"/v1/business/coupons/{coupon['id']}", headers=second)
    assert resp.status_code == 404


async def test_a_coupon_window_must_end_after_it_starts(client, db):
    headers, _, _ = await approved_partner(client, db)

    resp = await client.post(
        "/v1/business/coupons",
        json=coupon_payload(
            starts_at=(utcnow() + timedelta(days=5)).isoformat(),
            ends_at=(utcnow() + timedelta(days=1)).isoformat(),
        ),
        headers=headers,
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "BAD_WINDOW"


async def test_an_expired_coupon_drops_out_of_the_catalogue(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post(
            "/v1/business/coupons",
            json=coupon_payload(ends_at=(utcnow() + timedelta(seconds=2)).isoformat()),
            headers=headers,
        )
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    assert len((await client.get("/v1/coupons")).json()) == 1

    from app.models.coupon import Coupon

    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    row.ends_at = utcnow() - timedelta(minutes=1)
    await db.commit()

    assert (await client.get("/v1/coupons")).json() == []


async def test_a_sold_out_coupon_drops_out_of_the_catalogue(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post(
            "/v1/business/coupons", json=coupon_payload(quantity_total=1), headers=headers
        )
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    from app.models.coupon import Coupon

    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    row.quantity_redeemed = 1
    await db.commit()

    assert (await client.get("/v1/coupons")).json() == []


# --- stories ----------------------------------------------------------------


def story_payload(**overrides) -> dict:
    body = {"media_type": "image", "media_path": "stories/abc.jpg", "caption": "New menu!"}
    body.update(overrides)
    return body


async def test_story_lifetime_starts_at_approval_not_creation(client, db):
    headers, _, staff = await approved_partner(client, db)
    story = (
        await client.post("/v1/business/stories", json=story_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/stories/{story['id']}/submit", headers=headers)

    before = utcnow()
    approved = (
        await client.post(f"/v1/admin/stories/{story['id']}/approve", headers=staff)
    ).json()

    row = await db.get(Story, uuid.UUID(story["id"]))
    lifetime = as_aware(row.expires_at) - as_aware(row.published_at)
    assert lifetime == timedelta(hours=24)
    assert as_aware(row.published_at) >= before
    assert approved["status"] == "approved"


async def test_only_approved_unexpired_stories_reach_the_feed(client, db):
    headers, _, staff = await approved_partner(client, db)
    story = (
        await client.post("/v1/business/stories", json=story_payload(), headers=headers)
    ).json()

    assert (await client.get("/v1/stories")).json() == []  # draft

    await client.post(f"/v1/business/stories/{story['id']}/submit", headers=headers)
    assert (await client.get("/v1/stories")).json() == []  # pending

    await client.post(f"/v1/admin/stories/{story['id']}/approve", headers=staff)
    assert len((await client.get("/v1/stories")).json()) == 1

    row = await db.get(Story, uuid.UUID(story["id"]))
    row.expires_at = utcnow() - timedelta(minutes=1)
    await db.commit()
    assert (await client.get("/v1/stories")).json() == []  # expired


async def test_the_sweeper_returns_expired_stories_to_drafts(client, db):
    headers, _, staff = await approved_partner(client, db)
    story = (
        await client.post("/v1/business/stories", json=story_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/stories/{story['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/stories/{story['id']}/approve", headers=staff)

    row = await db.get(Story, uuid.UUID(story["id"]))
    row.expires_at = utcnow() - timedelta(minutes=1)
    await db.commit()

    assert await stories_service.expire_due_stories(db) == 1

    await db.refresh(row)
    assert row.status == "draft"
    assert row.expires_at is None


async def test_marking_a_story_seen_is_idempotent(client, db):
    headers, _, staff = await approved_partner(client, db)
    story = (
        await client.post("/v1/business/stories", json=story_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/stories/{story['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/stories/{story['id']}/approve", headers=staff)

    walker = await consumer_headers(client)
    first = await client.post(f"/v1/stories/{story['id']}/seen", headers=walker)
    second = await client.post(f"/v1/stories/{story['id']}/seen", headers=walker)

    assert first.json()["message"] == "Recorded."
    assert second.json()["message"] == "Already seen."


async def test_the_story_allowance_is_enforced(client, db):
    headers, _, _ = await approved_partner(client, db)

    for index in range(5):
        created = await client.post(
            "/v1/business/stories",
            json=story_payload(media_path=f"stories/{index}.jpg"),
            headers=headers,
        )
        await client.post(
            f"/v1/business/stories/{created.json()['id']}/submit", headers=headers
        )

    resp = await client.post("/v1/business/stories", json=story_payload(), headers=headers)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "STORY_LIMIT_REACHED"


# --- suspension -------------------------------------------------------------


async def test_suspending_a_business_pulls_its_content_offline(client, db):
    headers, partner, staff = await approved_partner(client, db)

    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    story = (
        await client.post("/v1/business/stories", json=story_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/stories/{story['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/stories/{story['id']}/approve", headers=staff)

    assert len((await client.get("/v1/coupons")).json()) == 1
    assert len((await client.get("/v1/stories")).json()) == 1

    await client.post(
        f"/v1/admin/partners/{partner['id']}/suspend",
        json={"reason": "Complaints from customers."},
        headers=staff,
    )

    assert (await client.get("/v1/coupons")).json() == []
    assert (await client.get("/v1/stories")).json() == []
    assert (await client.get("/v1/partners")).json() == []


async def test_a_suspended_business_cannot_submit_new_content(client, db):
    headers, partner, staff = await approved_partner(client, db)
    await client.post(
        f"/v1/admin/partners/{partner['id']}/suspend",
        json={"reason": "Under investigation."},
        headers=staff,
    )

    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    resp = await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PARTNER_SUSPENDED"


# --- dashboard --------------------------------------------------------------


async def test_the_moderation_queue_counts_everything_waiting(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    await register_partner(client, "waiting@example.com", "Waiting Co")

    queue = (await client.get("/v1/admin/queue", headers=staff)).json()
    assert queue["coupons"] == 1
    assert queue["partners"] == 1
    assert queue["stories"] == 0


async def test_partner_stats_reflect_live_content(client, db):
    headers, _, staff = await approved_partner(client, db)
    coupon = (
        await client.post("/v1/business/coupons", json=coupon_payload(), headers=headers)
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=headers)
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    stats = (await client.get("/v1/business/stats", headers=headers)).json()
    assert stats["live_coupons"] == 1
    assert stats["pending_coupons"] == 0
    assert stats["coupons_purchased"] == 0
