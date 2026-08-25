"""Buying a coupon and redeeming it: the paths where coins and promises move."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select

from app.core.time import as_aware, utcnow
from app.models.coupon import Coupon, UserCoupon
from app.models.economy import CoinTransaction
from app.models.enums import CoinSource, UserCouponStatus, UserRole
from app.models.user import User
from app.services import redemptions as redemptions_service

SYNC = "/v1/steps/sync"


def coupon_payload(**overrides) -> dict:
    body = {
        "title": "Free coffee",
        "description": "One large coffee on us.",
        "cost_coins": 100,
        "quantity_total": 10,
        "starts_at": (utcnow() - timedelta(hours=1)).isoformat(),
        "ends_at": (utcnow() + timedelta(days=30)).isoformat(),
    }
    body.update(overrides)
    return body


async def admin_headers(client, db, email="boss@example.com"):
    await client.post("/v1/auth/register", json={"email": email, "password": "correct-horse"})
    user = await db.scalar(select(User).where(User.email == email))
    user.role = UserRole.SUPERADMIN
    await db.commit()
    resp = await client.post(
        "/v1/auth/staff/login", json={"email": email, "password": "correct-horse"}
    )
    return {"Authorization": f"Bearer {resp.json()['tokens']['access_token']}"}


async def live_coupon(client, db, staff=None, **overrides):
    """An approved business with one approved, purchasable coupon."""
    reg = await client.post(
        "/v1/partners/register",
        json={
            "email": overrides.pop("partner_email", "cafe@example.com"),
            "password": "correct-horse",
            "company_name": overrides.pop("company", "Bean There"),
        },
    )
    partner_headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}
    partner = reg.json()["partner"]

    staff = staff or await admin_headers(client, db)
    await client.post(f"/v1/admin/partners/{partner['id']}/approve", headers=staff)

    coupon = (
        await client.post(
            "/v1/business/coupons", json=coupon_payload(**overrides), headers=partner_headers
        )
    ).json()
    await client.post(f"/v1/business/coupons/{coupon['id']}/submit", headers=partner_headers)
    await client.post(f"/v1/admin/coupons/{coupon['id']}/approve", headers=staff)

    return partner_headers, partner, coupon, staff


async def funded_walker(client, email="walker@example.com", steps=15_000):
    """A consumer with coins, earned the only way coins can be earned."""
    reg = await client.post(
        "/v1/auth/register", json={"email": email, "password": "correct-horse"}
    )
    headers = {"Authorization": f"Bearer {reg.json()['tokens']['access_token']}"}
    await client.post(
        SYNC, json={"date": utcnow().date().isoformat(), "steps": steps}, headers=headers
    )
    return headers


# --- purchase ---------------------------------------------------------------


async def test_purchase_debits_the_ledger_and_issues_a_voucher(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)  # 15k steps -> 150 coins

    resp = await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["balance"] == 50
    assert body["voucher"]["status"] == "active"
    assert body["voucher"]["cost_paid"] == 100
    assert body["voucher"]["coupon"]["title"] == "Free coffee"
    uuid.UUID(body["voucher"]["qr_token"])  # server-generated, well-formed

    entry = await db.scalar(
        select(CoinTransaction).where(CoinTransaction.source == CoinSource.COUPON_PURCHASE)
    )
    assert entry.amount == -100


async def test_purchase_is_refused_without_enough_coins(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client, steps=6_000)  # 60 coins, coupon costs 100

    resp = await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INSUFFICIENT_COINS"
    assert (await client.get("/v1/wallet", headers=walker)).json()["balance"] == 60


async def test_a_failed_purchase_leaves_no_trace(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client, steps=6_000)
    await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)

    assert (await client.get("/v1/wallet/vouchers", headers=walker)).json() == []
    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    assert row.quantity_redeemed == 0


async def test_stock_is_consumed_and_the_coupon_sells_out(client, db):
    _, _, coupon, _ = await live_coupon(client, db, quantity_total=1, cost_coins=50)
    first = await funded_walker(client, "first@example.com")
    second = await funded_walker(client, "second@example.com")

    assert (await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=first)).status_code == 200

    sold_out = await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=second)
    assert sold_out.status_code == 422
    assert sold_out.json()["error"]["code"] == "SOLD_OUT"

    # And it leaves the catalogue.
    assert (await client.get("/v1/coupons")).json() == []


async def test_an_unapproved_coupon_cannot_be_bought(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    await client.post(f"/v1/business/coupons/{coupon['id']}/withdraw", headers=partner_headers)

    walker = await funded_walker(client)
    resp = await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NOT_APPROVED"


async def test_an_expired_coupon_cannot_be_bought(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    row.ends_at = utcnow() - timedelta(minutes=1)
    await db.commit()

    walker = await funded_walker(client)
    resp = await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "EXPIRED"


async def test_a_coupon_not_yet_on_sale_cannot_be_bought(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    row.starts_at = utcnow() + timedelta(days=1)
    await db.commit()

    walker = await funded_walker(client)
    resp = await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NOT_STARTED"


async def test_buying_twice_debits_twice(client, db):
    _, _, coupon, _ = await live_coupon(client, db, cost_coins=50)
    walker = await funded_walker(client)  # 150 coins

    await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    second = await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)

    assert second.json()["balance"] == 50
    assert len((await client.get("/v1/wallet/vouchers", headers=walker)).json()) == 2


async def test_purchase_requires_authentication(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    assert (await client.post(f"/v1/coupons/{coupon['id']}/purchase")).status_code == 401


# --- the wallet -------------------------------------------------------------


async def test_the_wallet_lists_vouchers_with_their_codes(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    bought = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    listed = (await client.get("/v1/wallet/vouchers", headers=walker)).json()
    assert len(listed) == 1
    assert listed[0]["qr_token"] == bought["qr_token"]

    summary = (await client.get("/v1/wallet/vouchers/summary", headers=walker)).json()
    assert summary == {"active": 1, "used": 0, "expired": 0}


async def test_another_user_cannot_read_your_voucher(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    stranger = await funded_walker(client, "stranger@example.com")
    resp = await client.get(f"/v1/wallet/vouchers/{voucher['id']}", headers=stranger)
    assert resp.status_code == 404


async def test_the_wallet_reports_expiry_before_the_sweeper_runs(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)

    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    row.ends_at = utcnow() - timedelta(minutes=1)
    await db.commit()

    listed = (await client.get("/v1/wallet/vouchers", headers=walker)).json()
    assert listed[0]["status"] == "expired"


# --- redemption -------------------------------------------------------------


async def test_scanning_burns_the_voucher_once(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    scanned = await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=partner_headers
    )
    assert scanned.status_code == 200, scanned.text
    assert scanned.json()["status"] == "used"
    assert scanned.json()["coupon_title"] == "Free coffee"

    replay = await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=partner_headers
    )
    assert replay.status_code == 409
    assert replay.json()["error"]["code"] == "ALREADY_USED"


async def test_preview_reads_a_code_without_burning_it(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    preview = await client.post(
        "/v1/redemptions/preview",
        json={"qr_token": voucher["qr_token"]},
        headers=partner_headers,
    )
    assert preview.json()["is_redeemable"] is True

    # Still active — previewing must not consume it.
    row = await db.get(UserCoupon, uuid.UUID(voucher["id"]))
    assert row.status == UserCouponStatus.ACTIVE


async def test_a_merchant_cannot_redeem_another_businesses_coupon(client, db):
    _, _, coupon, staff = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    rival = await client.post(
        "/v1/partners/register",
        json={
            "email": "rival@example.com",
            "password": "correct-horse",
            "company_name": "Rival Cafe",
        },
    )
    rival_headers = {"Authorization": f"Bearer {rival.json()['tokens']['access_token']}"}
    await client.post(
        f"/v1/admin/partners/{rival.json()['partner']['id']}/approve", headers=staff
    )

    resp = await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=rival_headers
    )
    # Indistinguishable from an unknown code, on purpose.
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_an_unknown_code_is_refused(client, db):
    partner_headers, _, _, _ = await live_coupon(client, db)

    resp = await client.post(
        "/v1/redemptions/scan",
        json={"qr_token": str(uuid.uuid4())},
        headers=partner_headers,
    )
    assert resp.status_code == 404


async def test_an_expired_voucher_is_refused_at_the_till(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    row.ends_at = utcnow() - timedelta(minutes=1)
    await db.commit()

    resp = await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=partner_headers
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "EXPIRED"


async def test_a_consumer_cannot_scan(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    resp = await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=walker
    )
    assert resp.status_code == 403


async def test_redemption_can_be_attributed_to_a_branch(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    branch = (
        await client.post(
            "/v1/business/branches",
            json={"name": "Main street", "address": "1 Main st"},
            headers=partner_headers,
        )
    ).json()

    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    await client.post(
        "/v1/redemptions/scan",
        json={"qr_token": voucher["qr_token"], "branch_id": branch["id"]},
        headers=partner_headers,
    )

    history = (await client.get("/v1/redemptions", headers=partner_headers)).json()
    assert history[0]["branch_id"] == branch["id"]


async def test_a_branch_from_another_business_is_refused(client, db):
    partner_headers, _, coupon, staff = await live_coupon(client, db)
    rival = await client.post(
        "/v1/partners/register",
        json={
            "email": "rival@example.com",
            "password": "correct-horse",
            "company_name": "Rival",
        },
    )
    rival_headers = {"Authorization": f"Bearer {rival.json()['tokens']['access_token']}"}
    await client.post(
        f"/v1/admin/partners/{rival.json()['partner']['id']}/approve", headers=staff
    )
    rival_branch = (
        await client.post(
            "/v1/business/branches", json={"name": "Theirs"}, headers=rival_headers
        )
    ).json()

    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    resp = await client.post(
        "/v1/redemptions/scan",
        json={"qr_token": voucher["qr_token"], "branch_id": rival_branch["id"]},
        headers=partner_headers,
    )
    assert resp.status_code == 404


# --- reporting --------------------------------------------------------------


async def test_partner_sales_figures(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db, cost_coins=50)
    first = await funded_walker(client, "a@example.com")
    second = await funded_walker(client, "b@example.com")

    bought = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=first)
    ).json()["voucher"]
    await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=second)
    await client.post(
        "/v1/redemptions/scan", json={"qr_token": bought["qr_token"]}, headers=partner_headers
    )

    sales = (
        await client.get(
            f"/v1/redemptions/coupons/{coupon['id']}/sales", headers=partner_headers
        )
    ).json()
    assert sales == {"issued": 2, "redeemed": 1, "coins_collected": 100}

    stats = (await client.get("/v1/business/stats", headers=partner_headers)).json()
    assert stats["coupons_purchased"] == 2
    assert stats["coupons_redeemed"] == 1


async def test_a_partner_cannot_read_another_businesses_sales(client, db):
    _, _, coupon, staff = await live_coupon(client, db)
    rival = await client.post(
        "/v1/partners/register",
        json={
            "email": "rival@example.com",
            "password": "correct-horse",
            "company_name": "Rival",
        },
    )
    rival_headers = {"Authorization": f"Bearer {rival.json()['tokens']['access_token']}"}
    await client.post(
        f"/v1/admin/partners/{rival.json()['partner']['id']}/approve", headers=staff
    )

    resp = await client.get(
        f"/v1/redemptions/coupons/{coupon['id']}/sales", headers=rival_headers
    )
    assert resp.status_code == 404


async def test_a_purchased_coupon_cannot_be_deleted(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    await client.post(f"/v1/business/coupons/{coupon['id']}/withdraw", headers=partner_headers)

    resp = await client.delete(f"/v1/business/coupons/{coupon['id']}", headers=partner_headers)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "COUPON_IN_USE"


async def test_stock_cannot_be_cut_below_what_was_issued(client, db):
    partner_headers, _, coupon, _ = await live_coupon(
        client, db, quantity_total=5, cost_coins=50
    )
    walker = await funded_walker(client)  # 150 coins buys two
    await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    await client.post(f"/v1/business/coupons/{coupon['id']}/withdraw", headers=partner_headers)

    # Two are already in people's wallets, so the floor is two.
    allowed = await client.patch(
        f"/v1/business/coupons/{coupon['id']}",
        json={"quantity_total": 2},
        headers=partner_headers,
    )
    assert allowed.status_code == 200

    blocked = await client.patch(
        f"/v1/business/coupons/{coupon['id']}",
        json={"quantity_total": 1},
        headers=partner_headers,
    )
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "STOCK_BELOW_REDEEMED"


async def test_the_sweeper_expires_vouchers(client, db):
    _, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    row = await db.get(Coupon, uuid.UUID(coupon["id"]))
    row.ends_at = utcnow() - timedelta(minutes=1)
    await db.commit()

    assert await redemptions_service.expire_due_vouchers(db) == 1

    stored = await db.get(UserCoupon, uuid.UUID(voucher["id"]))
    await db.refresh(stored)
    assert stored.status == UserCouponStatus.EXPIRED


async def test_the_buyer_is_notified_on_purchase_and_redemption(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]
    await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=partner_headers
    )

    from app.models.notification import Notification

    rows = list((await db.scalars(select(Notification))).all())
    titles = {row.title for row in rows}
    assert "Coupon added to your wallet" in titles
    assert "Coupon redeemed" in titles


async def test_used_at_is_stamped(client, db):
    partner_headers, _, coupon, _ = await live_coupon(client, db)
    walker = await funded_walker(client)
    voucher = (
        await client.post(f"/v1/coupons/{coupon['id']}/purchase", headers=walker)
    ).json()["voucher"]

    before = utcnow()
    await client.post(
        "/v1/redemptions/scan", json={"qr_token": voucher["qr_token"]}, headers=partner_headers
    )

    row = await db.get(UserCoupon, uuid.UUID(voucher["id"]))
    await db.refresh(row)
    assert as_aware(row.used_at) >= before
    assert row.scanned_by_id is not None
