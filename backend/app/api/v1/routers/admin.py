"""Superadmin endpoints: moderation queues, step review, and economy tuning.

Every mutating action here writes an :class:`AdminActionLog` entry, so an approval,
a rejection, or a coin adjustment can always be traced back to a person.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.core.deps import DbSession, SuperadminUser, client_ip
from app.core.errors import NotFound, ValidationError
from app.models.audit import AdminActionLog
from app.models.enums import CoinSource, FlagStatus, PartnerStatus
from app.models.user import User
from app.schemas.admin import (
    AdjustmentResult,
    EconomySettingsFull,
    EconomySettingsUpdate,
    FlaggedDayPublic,
    FlaggedEventPublic,
    LedgerAdjustment,
    ReleaseResult,
    ReviewDecision,
)
from app.schemas.content import (
    CouponPrivate,
    ModerationQueue,
    RejectionRequest,
    StoryPrivate,
)
from app.schemas.notifications import BroadcastRequest, BroadcastResult
from app.schemas.partners import PartnerPrivate, PartnerReviewDecision
from app.services import antifraud, economy
from app.services import coupons as coupons_service
from app.services import notifications as notifications_service
from app.services import partners as partners_service
from app.services import steps as steps_service
from app.services import stories as stories_service
from app.services import support as support_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _log(
    db: DbSession,
    *,
    actor: User,
    action: str,
    target_type: str,
    target_id: uuid.UUID | str,
    changes: dict,
    ip: str = "",
) -> None:
    db.add(
        AdminActionLog(
            actor_id=actor.id,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            changes=changes,
            ip_address=ip,
        )
    )


@router.get("/steps/flagged", response_model=list[FlaggedDayPublic])
async def list_flagged_days(
    db: DbSession,
    admin: SuperadminUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[FlaggedDayPublic]:
    """Step days withholding coins until someone looks at them, oldest first."""
    econ = await economy.get_settings_row(db)
    days = await antifraud.suspicious_days(db, limit=limit)

    out: list[FlaggedDayPublic] = []
    for day in days:
        owner = await db.get(User, day.user_id)
        earned = economy.compute_steps_reward(day.steps, econ)
        out.append(
            FlaggedDayPublic(
                day_id=day.id,
                user_id=day.user_id,
                user_label=(owner.email or owner.phone or str(day.user_id)) if owner else "",
                date=day.date,
                steps=day.steps,
                coins_awarded=day.coins_awarded,
                coins_pending=max(earned - day.coins_awarded, 0),
                reason=day.suspicion_reason,
                source=day.source,
            )
        )
    await db.commit()
    return out


@router.post("/steps/flagged/{day_id}/approve", response_model=ReleaseResult)
async def approve_flagged_day(
    day_id: uuid.UUID, db: DbSession, admin: SuperadminUser, request: Request
) -> ReleaseResult:
    """Accept the day as genuine and pay out the coins it earned."""
    result = await steps_service.release_flagged_day(db, day_id=day_id, reviewer_id=admin.id)
    _log(
        db,
        actor=admin,
        action="steps.release",
        target_type="daily_steps",
        target_id=day_id,
        changes={"coins_awarded": result.coins_awarded, "steps": result.day.steps},
        ip=client_ip(request),
    )
    await db.commit()
    return ReleaseResult(
        day_id=day_id, coins_awarded=result.coins_awarded, balance=result.balance
    )


@router.post("/steps/flagged/{day_id}/reject", response_model=FlaggedDayPublic)
async def reject_flagged_day(
    day_id: uuid.UUID,
    payload: ReviewDecision,
    db: DbSession,
    admin: SuperadminUser,
    request: Request,
) -> FlaggedDayPublic:
    """Discard the day. No coins are paid, and the account is not blocked."""
    day = await steps_service.reject_flagged_day(
        db, day_id=day_id, reviewer_id=admin.id, reason=payload.reason
    )
    _log(
        db,
        actor=admin,
        action="steps.reject",
        target_type="daily_steps",
        target_id=day_id,
        changes={"reason": payload.reason, "steps": day.steps},
        ip=client_ip(request),
    )
    await db.commit()

    owner = await db.get(User, day.user_id)
    return FlaggedDayPublic(
        day_id=day.id,
        user_id=day.user_id,
        user_label=(owner.email or owner.phone or str(day.user_id)) if owner else "",
        date=day.date,
        steps=day.steps,
        coins_awarded=day.coins_awarded,
        coins_pending=0,
        reason=day.suspicion_reason,
        source=day.source,
    )


@router.get("/flags", response_model=list[FlaggedEventPublic])
async def list_flags(
    db: DbSession,
    admin: SuperadminUser,
    status: Annotated[FlagStatus | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[FlaggedEventPublic]:
    """The raw anti-fraud signal log, filterable by review status."""
    from sqlalchemy import select

    from app.models.audit import FlaggedEvent

    query = select(FlaggedEvent).order_by(FlaggedEvent.created_at.desc()).limit(limit)
    if status is not None:
        query = query.where(FlaggedEvent.status == status)

    rows = await db.scalars(query)
    return [FlaggedEventPublic.model_validate(row) for row in rows.all()]


@router.get("/economy", response_model=EconomySettingsFull)
async def get_economy(db: DbSession, admin: SuperadminUser) -> EconomySettingsFull:
    econ = await economy.get_settings_row(db)
    await db.commit()
    return EconomySettingsFull.model_validate(econ)


@router.patch("/economy", response_model=EconomySettingsFull)
async def update_economy(
    payload: EconomySettingsUpdate, db: DbSession, admin: SuperadminUser, request: Request
) -> EconomySettingsFull:
    """Change reward rates and anti-fraud limits without a deploy."""
    econ = await economy.get_settings_row(db)
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        raise ValidationError("No settings supplied.", code="NOTHING_TO_UPDATE")

    for field, value in changes.items():
        setattr(econ, field, value)

    if econ.hard_cap_steps_per_day < econ.suspicious_steps_per_day:
        raise ValidationError(
            "The hard cap must be at least the suspicion threshold.", code="INVALID_LIMITS"
        )

    _log(
        db,
        actor=admin,
        action="economy.update",
        target_type="economy_settings",
        target_id=econ.id,
        changes=changes,
        ip=client_ip(request),
    )
    await db.commit()
    await db.refresh(econ)
    return EconomySettingsFull.model_validate(econ)


@router.post("/ledger/adjust", response_model=AdjustmentResult)
async def adjust_ledger(
    payload: LedgerAdjustment, db: DbSession, admin: SuperadminUser, request: Request
) -> AdjustmentResult:
    """Manually credit or debit a user. Appends an entry; never edits history."""
    if payload.amount == 0:
        raise ValidationError("Adjustment cannot be zero.", code="ZERO_ADJUSTMENT")

    target = await db.get(User, payload.user_id)
    if target is None:
        raise NotFound("User not found.")

    economy.record_entry(
        db,
        user_id=target.id,
        amount=payload.amount,
        source=CoinSource.ADMIN_ADJUST,
        note=payload.note,
    )
    _log(
        db,
        actor=admin,
        action="ledger.adjust",
        target_type="user",
        target_id=target.id,
        changes={"amount": payload.amount, "note": payload.note},
        ip=client_ip(request),
    )
    await db.commit()

    return AdjustmentResult(
        user_id=target.id,
        amount=payload.amount,
        balance=await economy.get_balance(db, target.id),
    )


# --- moderation queues ------------------------------------------------------


@router.get("/queue", response_model=ModerationQueue)
async def moderation_queue(db: DbSession, admin: SuperadminUser) -> ModerationQueue:
    """How much is waiting, for the dashboard badge counts."""
    return ModerationQueue(
        partners=len(await partners_service.pending_partners(db, limit=1000)),
        coupons=len(await coupons_service.pending_coupons(db, limit=1000)),
        stories=len(await stories_service.pending_stories(db, limit=1000)),
        flagged_steps=len(await antifraud.suspicious_days(db, limit=1000)),
        support_tickets=await support_service.awaiting_reply_count(db),
    )


@router.get("/partners/pending", response_model=list[PartnerPrivate])
async def list_pending_partners(
    db: DbSession,
    admin: SuperadminUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[PartnerPrivate]:
    rows = await partners_service.pending_partners(db, limit=limit)
    return [PartnerPrivate.model_validate(row) for row in rows]


@router.post("/partners/{partner_id}/approve", response_model=PartnerPrivate)
async def approve_partner(
    partner_id: uuid.UUID, db: DbSession, admin: SuperadminUser, request: Request
) -> PartnerPrivate:
    """Let the business operate. Its coupons and stories still need their own review."""
    partner = await partners_service.set_partner_status(
        db, partner_id=partner_id, status=PartnerStatus.APPROVED
    )
    _log(
        db,
        actor=admin,
        action="partner.approve",
        target_type="partner",
        target_id=partner_id,
        changes={"company_name": partner.company_name},
        ip=client_ip(request),
    )
    await db.commit()
    return PartnerPrivate.model_validate(partner)


@router.post("/partners/{partner_id}/reject", response_model=PartnerPrivate)
async def reject_partner(
    partner_id: uuid.UUID,
    payload: PartnerReviewDecision,
    db: DbSession,
    admin: SuperadminUser,
    request: Request,
) -> PartnerPrivate:
    partner = await partners_service.set_partner_status(
        db, partner_id=partner_id, status=PartnerStatus.REJECTED, reason=payload.reason
    )
    _log(
        db,
        actor=admin,
        action="partner.reject",
        target_type="partner",
        target_id=partner_id,
        changes={"reason": payload.reason},
        ip=client_ip(request),
    )
    await db.commit()
    return PartnerPrivate.model_validate(partner)


@router.post("/partners/{partner_id}/suspend", response_model=PartnerPrivate)
async def suspend_partner(
    partner_id: uuid.UUID,
    payload: PartnerReviewDecision,
    db: DbSession,
    admin: SuperadminUser,
    request: Request,
) -> PartnerPrivate:
    """Pull a live business offline. Its published content comes down with it."""
    partner = await partners_service.set_partner_status(
        db, partner_id=partner_id, status=PartnerStatus.SUSPENDED, reason=payload.reason
    )
    _log(
        db,
        actor=admin,
        action="partner.suspend",
        target_type="partner",
        target_id=partner_id,
        changes={"reason": payload.reason},
        ip=client_ip(request),
    )
    await db.commit()
    return PartnerPrivate.model_validate(partner)


@router.get("/coupons/pending", response_model=list[CouponPrivate])
async def list_pending_coupons(
    db: DbSession,
    admin: SuperadminUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[CouponPrivate]:
    rows = await coupons_service.pending_coupons(db, limit=limit)
    return [CouponPrivate.model_validate(row) for row in rows]


@router.post("/coupons/{coupon_id}/approve", response_model=CouponPrivate)
async def approve_coupon(
    coupon_id: uuid.UUID, db: DbSession, admin: SuperadminUser, request: Request
) -> CouponPrivate:
    coupon = await coupons_service.review_coupon(
        db, coupon_id=coupon_id, reviewer_id=admin.id, approved=True
    )
    _log(
        db,
        actor=admin,
        action="coupon.approve",
        target_type="coupon",
        target_id=coupon_id,
        changes={"title": coupon.title, "cost_coins": coupon.cost_coins},
        ip=client_ip(request),
    )
    await db.commit()
    return CouponPrivate.model_validate(coupon)


@router.post("/coupons/{coupon_id}/reject", response_model=CouponPrivate)
async def reject_coupon(
    coupon_id: uuid.UUID,
    payload: RejectionRequest,
    db: DbSession,
    admin: SuperadminUser,
    request: Request,
) -> CouponPrivate:
    coupon = await coupons_service.review_coupon(
        db, coupon_id=coupon_id, reviewer_id=admin.id, approved=False, reason=payload.reason
    )
    _log(
        db,
        actor=admin,
        action="coupon.reject",
        target_type="coupon",
        target_id=coupon_id,
        changes={"reason": payload.reason},
        ip=client_ip(request),
    )
    await db.commit()
    return CouponPrivate.model_validate(coupon)


@router.get("/stories/pending", response_model=list[StoryPrivate])
async def list_pending_stories(
    db: DbSession,
    admin: SuperadminUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[StoryPrivate]:
    rows = await stories_service.pending_stories(db, limit=limit)
    return [StoryPrivate.model_validate(row) for row in rows]


@router.post("/stories/{story_id}/approve", response_model=StoryPrivate)
async def approve_story(
    story_id: uuid.UUID, db: DbSession, admin: SuperadminUser, request: Request
) -> StoryPrivate:
    """Publish the story and start its lifetime clock from this moment."""
    story = await stories_service.review_story(
        db, story_id=story_id, reviewer_id=admin.id, approved=True
    )
    _log(
        db,
        actor=admin,
        action="story.approve",
        target_type="story",
        target_id=story_id,
        changes={"expires_at": story.expires_at.isoformat() if story.expires_at else None},
        ip=client_ip(request),
    )
    await db.commit()
    return StoryPrivate.model_validate(story)


@router.post("/stories/{story_id}/reject", response_model=StoryPrivate)
async def reject_story(
    story_id: uuid.UUID,
    payload: RejectionRequest,
    db: DbSession,
    admin: SuperadminUser,
    request: Request,
) -> StoryPrivate:
    story = await stories_service.review_story(
        db, story_id=story_id, reviewer_id=admin.id, approved=False, reason=payload.reason
    )
    _log(
        db,
        actor=admin,
        action="story.reject",
        target_type="story",
        target_id=story_id,
        changes={"reason": payload.reason},
        ip=client_ip(request),
    )
    await db.commit()
    return StoryPrivate.model_validate(story)



@router.post("/notifications/broadcast", response_model=BroadcastResult)
async def broadcast(
    payload: BroadcastRequest, db: DbSession, admin: SuperadminUser, request: Request
) -> BroadcastResult:
    """Send one message to every active user, or to a single role.

    Writes an inbox row per recipient and pushes one multicast, so the message
    survives a device being offline.
    """
    recipients = await notifications_service.broadcast(
        db,
        title=payload.title,
        body=payload.body,
        role=payload.role,
        notification_type=payload.notification_type,
        data=payload.data,
    )
    _log(
        db,
        actor=admin,
        action="notifications.broadcast",
        target_type="broadcast",
        target_id=payload.role or "all",
        changes={"title": payload.title, "recipients": recipients},
        ip=client_ip(request),
    )
    await db.commit()
    return BroadcastResult(recipients=recipients)
