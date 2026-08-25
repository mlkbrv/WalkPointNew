"""Partner onboarding, profile management, and superadmin approval.

A partner account and its business are created together: there is exactly one
``Partner`` per owning ``User``, so a merchant can never end up with two storefronts
or none. The business starts ``pending`` and is invisible to consumers until a
superadmin approves it — and approving the *business* is separate from approving
each coupon and story it publishes.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.security import hash_password
from app.core.time import utcnow
from app.models.enums import ModerationStatus, NotificationType, PartnerStatus, UserRole
from app.models.partner import Branch, Partner
from app.models.user import User


async def register_partner(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    company_name: str,
    contact_name: str = "",
    description: str = "",
    contact_phone: str = "",
) -> tuple[User, Partner]:
    """Create the partner account and its business in one step, both unapproved."""
    email = email.lower()
    if await db.scalar(select(User.id).where(User.email == email)):
        raise Conflict("An account with this email already exists.", code="EMAIL_TAKEN")

    owner = User(
        email=email,
        password_hash=hash_password(password),
        role=UserRole.PARTNER,
        full_name=contact_name,
    )
    db.add(owner)
    await db.flush()

    partner = Partner(
        owner_id=owner.id,
        company_name=company_name,
        description=description,
        contact_email=email,
        contact_phone=contact_phone,
        status=PartnerStatus.PENDING,
    )
    db.add(partner)
    await db.commit()
    await db.refresh(owner)
    await db.refresh(partner)
    return owner, partner


async def get_owned_partner(db: AsyncSession, *, owner_id: uuid.UUID) -> Partner:
    partner = await db.scalar(select(Partner).where(Partner.owner_id == owner_id))
    if partner is None:
        raise Forbidden("No partner business is attached to this account.", code="NO_PARTNER")
    return partner


def ensure_approved(partner: Partner) -> None:
    """Gate every action that puts something in front of consumers.

    An unapproved business must not be able to queue content for review — that
    would let a rejected merchant flood the moderation queue.
    """
    if partner.status == PartnerStatus.APPROVED:
        return
    if partner.status == PartnerStatus.SUSPENDED:
        raise Forbidden("This business is suspended.", code="PARTNER_SUSPENDED")
    raise BusinessRuleError(
        "This business has not been approved yet.", code="PARTNER_NOT_APPROVED"
    )


async def update_profile(db: AsyncSession, *, partner: Partner, changes: dict) -> Partner:
    for field, value in changes.items():
        setattr(partner, field, value)
    await db.commit()
    await db.refresh(partner)
    return partner


# --- branches ---------------------------------------------------------------


async def add_branch(db: AsyncSession, *, partner: Partner, data: dict) -> Branch:
    branch = Branch(partner_id=partner.id, **data)
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


async def get_owned_branch(
    db: AsyncSession, *, partner: Partner, branch_id: uuid.UUID
) -> Branch:
    branch = await db.scalar(
        select(Branch).where(Branch.id == branch_id, Branch.partner_id == partner.id)
    )
    if branch is None:
        raise NotFound("Branch not found.")
    return branch


async def list_branches(db: AsyncSession, *, partner_id: uuid.UUID) -> list[Branch]:
    rows = await db.scalars(
        select(Branch).where(Branch.partner_id == partner_id).order_by(Branch.name)
    )
    return list(rows.all())


# --- superadmin review ------------------------------------------------------


async def pending_partners(db: AsyncSession, *, limit: int = 50) -> list[Partner]:
    rows = await db.scalars(
        select(Partner)
        .where(Partner.status == PartnerStatus.PENDING)
        .order_by(Partner.created_at.asc())
        .limit(limit)
    )
    return list(rows.all())


async def set_partner_status(
    db: AsyncSession,
    *,
    partner_id: uuid.UUID,
    status: PartnerStatus,
    reason: str = "",
) -> Partner:
    """Approve, reject, or suspend a business.

    Suspending also pulls its live content off the shelf: leaving approved coupons
    purchasable from a suspended merchant is the failure mode this prevents.
    """
    partner = await db.get(Partner, partner_id)
    if partner is None:
        raise NotFound("Partner not found.")
    if partner.status == status:
        raise Conflict(f"Partner is already {status}.", code="NO_STATUS_CHANGE")
    if status in (PartnerStatus.REJECTED, PartnerStatus.SUSPENDED) and not reason.strip():
        raise BusinessRuleError(
            "Say why, so the partner knows what to fix.", code="REASON_REQUIRED"
        )

    partner.status = status
    partner.rejection_reason = reason.strip()

    if status in (PartnerStatus.REJECTED, PartnerStatus.SUSPENDED):
        await _unpublish_content(db, partner_id=partner.id)

    from app.services import notifications

    headline = {
        PartnerStatus.APPROVED: "Your business is approved",
        PartnerStatus.REJECTED: "Your application needs changes",
        PartnerStatus.SUSPENDED: "Your business has been suspended",
        PartnerStatus.PENDING: "Your business is under review",
    }[status]
    outcome = notifications.queue(
        db,
        user_id=partner.owner_id,
        title=headline,
        body=partner.rejection_reason or "You can now publish coupons and stories.",
        notification_type=NotificationType.MODERATION_RESULT,
        data={"partner_id": str(partner.id), "status": status},
    )

    await db.commit()
    await db.refresh(partner)

    await notifications.deliver(db, outcome)
    return partner


async def _unpublish_content(db: AsyncSession, *, partner_id: uuid.UUID) -> None:
    """Take every approved coupon and story of a partner back to draft."""
    from app.models.coupon import Coupon
    from app.models.story import Story

    for model in (Coupon, Story):
        rows = await db.scalars(
            select(model).where(
                model.partner_id == partner_id,
                model.status.in_([ModerationStatus.APPROVED, ModerationStatus.PENDING]),
            )
        )
        for row in rows:
            row.status = ModerationStatus.DRAFT
            row.published_at = None


# --- consumer view ----------------------------------------------------------


async def list_public_partners(
    db: AsyncSession, *, search: str = "", limit: int = 50, offset: int = 0
) -> list[Partner]:
    """Approved businesses only — this feeds the store list in the app."""
    query = select(Partner).where(Partner.status == PartnerStatus.APPROVED)
    if search:
        query = query.where(func.lower(Partner.company_name).contains(search.lower()))

    rows = await db.scalars(query.order_by(Partner.company_name).offset(offset).limit(limit))
    return list(rows.all())


async def get_public_partner(db: AsyncSession, *, partner_id: uuid.UUID) -> Partner:
    partner = await db.get(Partner, partner_id)
    if partner is None:
        raise NotFound("Store not found.")
    if partner.status != PartnerStatus.APPROVED:
        raise NotFound("Store not found.")
    return partner


async def partner_stats(db: AsyncSession, *, partner_id: uuid.UUID) -> dict[str, int]:
    """Headline numbers for the partner dashboard."""
    from app.models.coupon import Coupon, UserCoupon
    from app.models.enums import UserCouponStatus
    from app.models.story import Story

    coupon_ids = select(Coupon.id).where(Coupon.partner_id == partner_id).scalar_subquery()

    live_coupons = await db.scalar(
        select(func.count())
        .select_from(Coupon)
        .where(Coupon.partner_id == partner_id, Coupon.status == ModerationStatus.APPROVED)
    )
    pending_coupons = await db.scalar(
        select(func.count())
        .select_from(Coupon)
        .where(Coupon.partner_id == partner_id, Coupon.status == ModerationStatus.PENDING)
    )
    live_stories = await db.scalar(
        select(func.count())
        .select_from(Story)
        .where(
            Story.partner_id == partner_id,
            Story.status == ModerationStatus.APPROVED,
            Story.expires_at > utcnow(),
        )
    )
    purchased = await db.scalar(
        select(func.count()).select_from(UserCoupon).where(UserCoupon.coupon_id.in_(coupon_ids))
    )
    redeemed = await db.scalar(
        select(func.count())
        .select_from(UserCoupon)
        .where(
            UserCoupon.coupon_id.in_(coupon_ids),
            UserCoupon.status == UserCouponStatus.USED,
        )
    )

    return {
        "live_coupons": int(live_coupons or 0),
        "pending_coupons": int(pending_coupons or 0),
        "live_stories": int(live_stories or 0),
        "coupons_purchased": int(purchased or 0),
        "coupons_redeemed": int(redeemed or 0),
    }
