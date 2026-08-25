"""Partner stories: authoring, review, and the consumer feed.

A story's clock starts at **approval**, not at creation — ``expires_at`` is set to
``published_at + story_lifetime_hours``. A story stuck in the review queue
overnight therefore still gets its full run once someone approves it.

Expiry is enforced twice on purpose: the feed query filters on ``expires_at``, so
a stale story is never served even if the sweeper is down, and the sweeper flips
the status so the data does not accumulate as silently-hidden rows.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, NotFound
from app.core.time import as_aware, utcnow
from app.models.enums import ModerationStatus, NotificationType, PartnerStatus
from app.models.partner import Partner
from app.models.story import Story, StoryView
from app.services import economy, moderation, notifications

# --- partner authoring ------------------------------------------------------


async def create_story(db: AsyncSession, *, partner: Partner, data: dict) -> Story:
    econ = await economy.get_settings_row(db)

    live = await db.scalar(
        select(func.count())
        .select_from(Story)
        .where(
            Story.partner_id == partner.id,
            Story.status.in_([ModerationStatus.PENDING, ModerationStatus.APPROVED]),
        )
    )
    if int(live or 0) >= econ.max_stories_per_partner:
        raise BusinessRuleError(
            f"A business may have at most {econ.max_stories_per_partner} active stories.",
            code="STORY_LIMIT_REACHED",
        )

    story = Story(partner_id=partner.id, status=ModerationStatus.DRAFT, **data)
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return story


async def get_owned_story(db: AsyncSession, *, partner: Partner, story_id: uuid.UUID) -> Story:
    story = await db.scalar(
        select(Story).where(Story.id == story_id, Story.partner_id == partner.id)
    )
    if story is None:
        raise NotFound("Story not found.")
    return story


async def update_story(db: AsyncSession, *, story: Story, changes: dict) -> Story:
    moderation.ensure_editable(story, label="story")
    for field, value in changes.items():
        setattr(story, field, value)
    await db.commit()
    await db.refresh(story)
    return story


async def submit_story(db: AsyncSession, *, partner: Partner, story: Story) -> Story:
    from app.services import partners as partners_service

    partners_service.ensure_approved(partner)

    if not story.media_path:
        raise BusinessRuleError("Upload the media before submitting.", code="MEDIA_REQUIRED")

    moderation.submit(story, label="story")
    await db.commit()
    await db.refresh(story)
    return story


async def withdraw_story(db: AsyncSession, *, story: Story) -> Story:
    moderation.withdraw(story, label="story")
    story.expires_at = None
    await db.commit()
    await db.refresh(story)
    return story


async def delete_story(db: AsyncSession, *, story: Story) -> None:
    await db.delete(story)
    await db.commit()


async def list_partner_stories(
    db: AsyncSession, *, partner_id: uuid.UUID, status: ModerationStatus | None = None
) -> list[Story]:
    query = select(Story).where(Story.partner_id == partner_id)
    if status is not None:
        query = query.where(Story.status == status)
    rows = await db.scalars(query.order_by(Story.created_at.desc()))
    return list(rows.all())


# --- staff review -----------------------------------------------------------


async def pending_stories(db: AsyncSession, *, limit: int = 50) -> list[Story]:
    rows = await db.scalars(
        select(Story)
        .where(Story.status == ModerationStatus.PENDING)
        .order_by(Story.created_at.asc())
        .limit(limit)
    )
    return list(rows.all())


async def review_story(
    db: AsyncSession,
    *,
    story_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    approved: bool,
    reason: str = "",
) -> Story:
    story = await db.get(Story, story_id)
    if story is None:
        raise NotFound("Story not found.")

    owner = await db.get(Partner, story.partner_id)

    if approved:
        if owner is None or owner.status != PartnerStatus.APPROVED:
            raise BusinessRuleError(
                "Approve the business before publishing its stories.",
                code="PARTNER_NOT_APPROVED",
            )

        econ = await economy.get_settings_row(db)
        moderation.approve(story, reviewer_id=reviewer_id)
        # The lifetime runs from publication, so review delay does not eat into it.
        story.expires_at = as_aware(story.published_at) + timedelta(
            hours=econ.story_lifetime_hours
        )
        headline = "Story published"
        detail = f"It is live for {econ.story_lifetime_hours} hours."
    else:
        moderation.reject(story, reviewer_id=reviewer_id, reason=reason)
        story.expires_at = None
        headline = "Story needs changes"
        detail = story.rejection_reason

    outcome = (
        notifications.queue(
            db,
            user_id=owner.owner_id,
            title=headline,
            body=detail,
            notification_type=NotificationType.MODERATION_RESULT,
            data={"story_id": str(story.id), "status": story.status},
        )
        if owner
        else None
    )

    await db.commit()
    await db.refresh(story)

    if outcome is not None:
        await notifications.deliver(db, outcome)
    return story


# --- consumer feed ----------------------------------------------------------


async def feed(db: AsyncSession, *, limit: int = 50) -> list[Story]:
    """Live stories, newest first. Expiry is filtered here, not assumed."""
    now = utcnow()
    rows = await db.scalars(
        select(Story)
        .where(
            Story.status == ModerationStatus.APPROVED,
            Story.expires_at > now,
        )
        .order_by(Story.published_at.desc())
        .limit(limit)
    )
    return list(rows.all())


async def get_public_story(db: AsyncSession, *, story_id: uuid.UUID) -> Story:
    story = await db.get(Story, story_id)
    if story is None:
        raise NotFound("Story not found.")
    moderation.ensure_visible(story, label="story")
    if story.expires_at is not None and as_aware(story.expires_at) <= utcnow():
        from app.core.errors import Expired

        raise Expired("This story has expired.")
    return story


async def mark_seen(db: AsyncSession, *, story: Story, user_id: uuid.UUID) -> bool:
    """Record a view. Returns True the first time only, so rewards pay once."""
    existing = await db.scalar(
        select(StoryView).where(StoryView.story_id == story.id, StoryView.user_id == user_id)
    )
    if existing is not None:
        return False

    db.add(StoryView(story_id=story.id, user_id=user_id))
    await db.commit()
    return True


async def expire_due_stories(db: AsyncSession) -> int:
    """Sweeper: flip approved stories whose window has closed. Returns the count."""
    now = utcnow()
    rows = await db.scalars(
        select(Story).where(
            Story.status == ModerationStatus.APPROVED,
            Story.expires_at.is_not(None),
            Story.expires_at <= now,
        )
    )
    expired = 0
    for story in rows:
        # Back to the partner's drafts rather than a dead state: they can edit and
        # re-submit it, and it stops counting against their live-story allowance.
        story.status = ModerationStatus.DRAFT
        story.published_at = None
        story.expires_at = None
        expired += 1

    if expired:
        await db.commit()
    return expired
