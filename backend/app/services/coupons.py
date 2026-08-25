"""Coupon authoring by partners, review by staff, and the consumer catalogue.

Purchase and redemption are deliberately not here — they move coins and belong
with the ledger logic (step 4).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.time import as_aware, utcnow
from app.models.coupon import Coupon, CouponCategory
from app.models.enums import ModerationStatus, NotificationType, PartnerStatus
from app.models.partner import Partner
from app.services import moderation, notifications


def _validate_window(starts_at: datetime, ends_at: datetime) -> None:
    if ends_at <= starts_at:
        raise BusinessRuleError("The end date must be after the start date.", code="BAD_WINDOW")
    if as_aware(ends_at) <= utcnow():
        raise BusinessRuleError("The coupon would already be expired.", code="BAD_WINDOW")


# --- partner authoring ------------------------------------------------------


async def create_coupon(db: AsyncSession, *, partner: Partner, data: dict) -> Coupon:
    """Create a draft. Nothing reaches consumers until it is submitted and approved."""
    _validate_window(data["starts_at"], data["ends_at"])

    if data.get("category_id") and not await db.get(CouponCategory, data["category_id"]):
        raise NotFound("Category not found.")

    coupon = Coupon(partner_id=partner.id, status=ModerationStatus.DRAFT, **data)
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return coupon


async def get_owned_coupon(
    db: AsyncSession, *, partner: Partner, coupon_id: uuid.UUID
) -> Coupon:
    coupon = await db.scalar(
        select(Coupon).where(Coupon.id == coupon_id, Coupon.partner_id == partner.id)
    )
    if coupon is None:
        raise NotFound("Coupon not found.")
    return coupon


async def update_coupon(db: AsyncSession, *, coupon: Coupon, changes: dict) -> Coupon:
    moderation.ensure_editable(coupon, label="coupon")

    starts_at = changes.get("starts_at", coupon.starts_at)
    ends_at = changes.get("ends_at", coupon.ends_at)
    if "starts_at" in changes or "ends_at" in changes:
        _validate_window(starts_at, ends_at)

    if changes.get("quantity_total") is not None:
        if changes["quantity_total"] < coupon.quantity_redeemed:
            raise BusinessRuleError(
                "Stock cannot drop below what has already been handed out.",
                code="STOCK_BELOW_REDEEMED",
            )

    for field, value in changes.items():
        setattr(coupon, field, value)

    await db.commit()
    await db.refresh(coupon)
    return coupon


async def submit_coupon(db: AsyncSession, *, partner: Partner, coupon: Coupon) -> Coupon:
    from app.services import partners as partners_service

    partners_service.ensure_approved(partner)

    if coupon.cost_coins <= 0:
        raise BusinessRuleError("Set a price in coins before submitting.", code="PRICE_REQUIRED")
    if coupon.quantity_total <= 0:
        raise BusinessRuleError("Set how many are available.", code="STOCK_REQUIRED")
    _validate_window(coupon.starts_at, coupon.ends_at)

    moderation.submit(coupon, label="coupon")
    await db.commit()
    await db.refresh(coupon)
    return coupon


async def withdraw_coupon(db: AsyncSession, *, coupon: Coupon) -> Coupon:
    moderation.withdraw(coupon, label="coupon")
    await db.commit()
    await db.refresh(coupon)
    return coupon


async def delete_coupon(db: AsyncSession, *, coupon: Coupon) -> None:
    """Only an untouched draft can be deleted; anything bought must stay auditable."""
    from app.models.coupon import UserCoupon

    if coupon.status == ModerationStatus.APPROVED:
        raise Conflict("Withdraw the coupon before deleting it.", code="ALREADY_APPROVED")

    issued = await db.scalar(
        select(func.count()).select_from(UserCoupon).where(UserCoupon.coupon_id == coupon.id)
    )
    if issued:
        raise Conflict(
            "This coupon has already been purchased and cannot be deleted.",
            code="COUPON_IN_USE",
        )

    await db.delete(coupon)
    await db.commit()


async def list_partner_coupons(
    db: AsyncSession,
    *,
    partner_id: uuid.UUID,
    status: ModerationStatus | None = None,
) -> list[Coupon]:
    query = select(Coupon).where(Coupon.partner_id == partner_id)
    if status is not None:
        query = query.where(Coupon.status == status)
    rows = await db.scalars(query.order_by(Coupon.created_at.desc()))
    return list(rows.all())


# --- staff review -----------------------------------------------------------


async def pending_coupons(db: AsyncSession, *, limit: int = 50) -> list[Coupon]:
    rows = await db.scalars(
        select(Coupon)
        .where(Coupon.status == ModerationStatus.PENDING)
        .order_by(Coupon.created_at.asc())
        .limit(limit)
    )
    return list(rows.all())


async def review_coupon(
    db: AsyncSession,
    *,
    coupon_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    approved: bool,
    reason: str = "",
) -> Coupon:
    coupon = await db.get(Coupon, coupon_id)
    if coupon is None:
        raise NotFound("Coupon not found.")

    owner = await db.get(Partner, coupon.partner_id)

    if approved:
        if owner is None or owner.status != PartnerStatus.APPROVED:
            raise BusinessRuleError(
                "Approve the business before publishing its coupons.",
                code="PARTNER_NOT_APPROVED",
            )
        moderation.approve(coupon, reviewer_id=reviewer_id)
        headline = "Coupon approved"
        detail = f"{coupon.title} is now live in the app."
    else:
        moderation.reject(coupon, reviewer_id=reviewer_id, reason=reason)
        headline = "Coupon needs changes"
        detail = f"{coupon.title}: {coupon.rejection_reason}"

    outcome = (
        notifications.queue(
            db,
            user_id=owner.owner_id,
            title=headline,
            body=detail,
            notification_type=NotificationType.MODERATION_RESULT,
            data={"coupon_id": str(coupon.id), "status": coupon.status},
        )
        if owner
        else None
    )

    await db.commit()
    await db.refresh(coupon)

    if outcome is not None:
        await notifications.deliver(db, outcome)
    if approved and owner is not None:
        await _announce_new_coupon(db, coupon=coupon, partner=owner)

    return coupon


async def _announce_new_coupon(db: AsyncSession, *, coupon: Coupon, partner: Partner) -> None:
    """Tell consumers a new offer is live.

    Deliberately push-only, with no inbox row: writing one per user for every
    approved coupon would bury the inbox, which is where users look for things
    that concern them personally.
    """
    from app.integrations import push
    from app.models.enums import UserRole
    from app.models.user import Device, User

    tokens = await db.scalars(
        select(Device.push_token)
        .join(User, User.id == Device.user_id)
        .where(
            Device.push_token != "",
            User.role == UserRole.USER,
            User.is_active.is_(True),
            User.is_blocked.is_(False),
        )
    )
    await push.safe_send(
        list({token for token in tokens.all() if token}),
        title=f"New offer from {partner.company_name}",
        body=f"{coupon.title} - {coupon.cost_coins} coins",
        data={"coupon_id": str(coupon.id)},
    )


# --- consumer catalogue -----------------------------------------------------


def _live_clause():
    """Approved, inside its date window, and not sold out."""
    now = utcnow()
    return (
        Coupon.status == ModerationStatus.APPROVED,
        Coupon.starts_at <= now,
        Coupon.ends_at > now,
        Coupon.quantity_redeemed < Coupon.quantity_total,
    )


async def list_catalogue(
    db: AsyncSession,
    *,
    partner_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    max_cost: int | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Coupon]:
    query = select(Coupon).where(*_live_clause())

    if partner_id:
        query = query.where(Coupon.partner_id == partner_id)
    if category_id:
        query = query.where(Coupon.category_id == category_id)
    if max_cost is not None:
        query = query.where(Coupon.cost_coins <= max_cost)

    rows = await db.scalars(
        query.order_by(Coupon.published_at.desc()).offset(offset).limit(limit)
    )
    return list(rows.all())


async def get_public_coupon(db: AsyncSession, *, coupon_id: uuid.UUID) -> Coupon:
    coupon = await db.get(Coupon, coupon_id)
    if coupon is None:
        raise NotFound("Coupon not found.")
    moderation.ensure_visible(coupon, label="coupon")
    return coupon


async def list_categories(db: AsyncSession) -> list[CouponCategory]:
    rows = await db.scalars(select(CouponCategory).order_by(CouponCategory.name))
    return list(rows.all())
