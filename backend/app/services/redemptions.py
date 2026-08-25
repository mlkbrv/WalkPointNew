"""Buying a coupon and redeeming it at the counter.

These are the two places where coins leave a wallet and where a promise is handed
to a merchant, so both are written as single transactions with explicit locks.

**Purchase** takes two row locks, always in the same order — the buyer's user row
first, then the coupon row. The user row is the wallet mutex: the balance is a
``SUM`` over the ledger, so without it two concurrent purchases could each read the
same balance and both succeed. Consistent lock ordering is what keeps two buyers
racing for the last coupon from deadlocking each other.

**Redemption** locks the voucher. A code presented twice at two tills must burn
exactly once.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    AlreadyUsed,
    BusinessRuleError,
    Expired,
    Forbidden,
    InsufficientCoins,
    NotFound,
    SoldOut,
)
from app.core.time import as_aware, utcnow
from app.models.coupon import Coupon, UserCoupon
from app.models.enums import CoinSource, ModerationStatus, UserCouponStatus
from app.models.partner import Branch, Partner
from app.models.user import User
from app.services import economy, notifications


async def purchase_coupon(
    db: AsyncSession, *, user: User, coupon_id: uuid.UUID
) -> tuple[UserCoupon, int]:
    """Spend coins on a coupon and issue the voucher. Returns ``(voucher, balance)``.

    Every check runs inside the locked window, because each one can be invalidated
    by a concurrent purchase: stock, the sale window, and the buyer's balance.
    """
    # Lock order: user, then coupon. See the module docstring.
    locked_user = await db.scalar(select(User).where(User.id == user.id).with_for_update())
    if locked_user is None:
        raise NotFound("User not found.")

    coupon = await db.scalar(select(Coupon).where(Coupon.id == coupon_id).with_for_update())
    if coupon is None:
        raise NotFound("Coupon not found.")

    _assert_purchasable(coupon)

    balance = await economy.get_balance(db, user.id)
    if balance < coupon.cost_coins:
        raise InsufficientCoins(
            f"This coupon costs {coupon.cost_coins} coins; the balance is {balance}."
        )

    # quantity_redeemed counts vouchers *issued*, which is what stock means to a
    # buyer — a coupon someone is holding is no longer available to anyone else.
    coupon.quantity_redeemed += 1

    economy.record_entry(
        db,
        user_id=user.id,
        amount=-coupon.cost_coins,
        source=CoinSource.COUPON_PURCHASE,
        note=coupon.title,
        reference_id=coupon.id,
    )

    voucher = UserCoupon(
        user_id=user.id,
        coupon_id=coupon.id,
        cost_paid=coupon.cost_coins,
        status=UserCouponStatus.ACTIVE,
    )
    db.add(voucher)

    note = notifications.queue(
        db,
        user_id=user.id,
        title="Coupon added to your wallet",
        body=f"{coupon.title} — show the code at the counter.",
        data={"coupon_id": str(coupon.id)},
    )

    await db.commit()
    await db.refresh(voucher)

    # After commit: a push attempt must never sit inside the locked window.
    await notifications.deliver(db, note)
    return voucher, await economy.get_balance(db, user.id)


def _assert_purchasable(coupon: Coupon) -> None:
    if coupon.status != ModerationStatus.APPROVED:
        from app.core.errors import NotApproved

        raise NotApproved("This coupon is not available.")

    now = utcnow()
    if as_aware(coupon.starts_at) > now:
        raise BusinessRuleError("This coupon is not on sale yet.", code="NOT_STARTED")
    if as_aware(coupon.ends_at) <= now:
        raise Expired("This coupon has expired.")
    if coupon.quantity_remaining <= 0:
        raise SoldOut()


# --- the buyer's wallet -----------------------------------------------------


async def list_vouchers(
    db: AsyncSession, *, user_id: uuid.UUID, status: UserCouponStatus | None = None
) -> list[UserCoupon]:
    """The user's vouchers, newest first, with expiry applied on read.

    A voucher whose coupon has ended is reported as expired even before the
    sweeper touches it, so the wallet never shows a code that would be refused.
    """
    query = select(UserCoupon).where(UserCoupon.user_id == user_id)
    if status is not None:
        query = query.where(UserCoupon.status == status)

    rows = list((await db.scalars(query.order_by(UserCoupon.created_at.desc()))).all())

    now = utcnow()
    for voucher in rows:
        if (
            voucher.status == UserCouponStatus.ACTIVE
            and as_aware(voucher.coupon.ends_at) <= now
        ):
            voucher.status = UserCouponStatus.EXPIRED

    if rows:
        await db.commit()

    if status is not None:
        rows = [voucher for voucher in rows if voucher.status == status]
    return rows


async def get_voucher(
    db: AsyncSession, *, user_id: uuid.UUID, voucher_id: uuid.UUID
) -> UserCoupon:
    voucher = await db.scalar(
        select(UserCoupon).where(UserCoupon.id == voucher_id, UserCoupon.user_id == user_id)
    )
    if voucher is None:
        raise NotFound("Coupon not found in your wallet.")
    return voucher


# --- the merchant's till ----------------------------------------------------


async def scan(
    db: AsyncSession,
    *,
    qr_token: uuid.UUID,
    partner: Partner,
    scanned_by_id: uuid.UUID,
    branch_id: uuid.UUID | None = None,
) -> UserCoupon:
    """Burn a voucher at the counter.

    Refuses a voucher belonging to another business, one already used, and one
    whose coupon has ended. The voucher row is locked so a code shown at two tills
    at once can only be accepted by one of them.
    """
    voucher = await db.scalar(
        select(UserCoupon).where(UserCoupon.qr_token == qr_token).with_for_update()
    )
    if voucher is None:
        raise NotFound("This code is not valid.")

    coupon = await db.get(Coupon, voucher.coupon_id)
    if coupon is None or coupon.partner_id != partner.id:
        # Deliberately the same message as an unknown code: a merchant has no
        # business learning that a code is real but belongs to a competitor.
        raise NotFound("This code is not valid.")

    if voucher.status == UserCouponStatus.USED:
        raise AlreadyUsed(
            f"This coupon was already used on {as_aware(voucher.used_at).date().isoformat()}."
            if voucher.used_at
            else "This coupon has already been used."
        )
    if voucher.status == UserCouponStatus.EXPIRED or as_aware(coupon.ends_at) <= utcnow():
        voucher.status = UserCouponStatus.EXPIRED
        await db.commit()
        raise Expired("This coupon has expired.")

    if branch_id is not None:
        branch = await db.scalar(
            select(Branch).where(Branch.id == branch_id, Branch.partner_id == partner.id)
        )
        if branch is None:
            raise NotFound("Branch not found.")

    voucher.status = UserCouponStatus.USED
    voucher.used_at = utcnow()
    voucher.used_at_branch_id = branch_id
    voucher.scanned_by_id = scanned_by_id

    note = notifications.queue(
        db,
        user_id=voucher.user_id,
        title="Coupon redeemed",
        body=f"{coupon.title} was redeemed at {partner.company_name}.",
        data={"coupon_id": str(coupon.id), "voucher_id": str(voucher.id)},
    )

    await db.commit()
    await db.refresh(voucher)

    await notifications.deliver(db, note)
    return voucher


async def preview(db: AsyncSession, *, qr_token: uuid.UUID, partner: Partner) -> UserCoupon:
    """Read a code without burning it, so the till can show what it is first."""
    voucher = await db.scalar(select(UserCoupon).where(UserCoupon.qr_token == qr_token))
    if voucher is None:
        raise NotFound("This code is not valid.")

    coupon = await db.get(Coupon, voucher.coupon_id)
    if coupon is None or coupon.partner_id != partner.id:
        raise NotFound("This code is not valid.")
    return voucher


async def partner_redemptions(
    db: AsyncSession, *, partner_id: uuid.UUID, limit: int = 50, offset: int = 0
) -> list[UserCoupon]:
    coupon_ids = select(Coupon.id).where(Coupon.partner_id == partner_id).scalar_subquery()
    rows = await db.scalars(
        select(UserCoupon)
        .where(
            UserCoupon.coupon_id.in_(coupon_ids),
            UserCoupon.status == UserCouponStatus.USED,
        )
        .order_by(UserCoupon.used_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(rows.all())


async def coupon_sales(db: AsyncSession, *, coupon_id: uuid.UUID) -> dict[str, int]:
    """Per-coupon numbers for the partner dashboard."""
    issued = await db.scalar(
        select(func.count()).select_from(UserCoupon).where(UserCoupon.coupon_id == coupon_id)
    )
    used = await db.scalar(
        select(func.count())
        .select_from(UserCoupon)
        .where(UserCoupon.coupon_id == coupon_id, UserCoupon.status == UserCouponStatus.USED)
    )
    coins = await db.scalar(
        select(func.coalesce(func.sum(UserCoupon.cost_paid), 0)).where(
            UserCoupon.coupon_id == coupon_id
        )
    )
    return {
        "issued": int(issued or 0),
        "redeemed": int(used or 0),
        "coins_collected": int(coins or 0),
    }


async def expire_due_vouchers(db: AsyncSession) -> int:
    """Sweeper: mark vouchers expired once their coupon's window has closed."""
    now = utcnow()
    expired_coupon_ids = select(Coupon.id).where(Coupon.ends_at <= now).scalar_subquery()

    rows = await db.scalars(
        select(UserCoupon).where(
            UserCoupon.status == UserCouponStatus.ACTIVE,
            UserCoupon.coupon_id.in_(expired_coupon_ids),
        )
    )
    count = 0
    for voucher in rows:
        voucher.status = UserCouponStatus.EXPIRED
        count += 1

    if count:
        await db.commit()
    return count


def ensure_owner(voucher: UserCoupon, user_id: uuid.UUID) -> None:
    if voucher.user_id != user_id:
        raise Forbidden("This coupon belongs to someone else.")
