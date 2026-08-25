"""Stories: the consumer feed and the partner's authoring endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentPartner, CurrentUser, DbSession
from app.models.enums import ModerationStatus
from app.schemas.common import Message
from app.schemas.content import StoryCreate, StoryPrivate, StoryPublic, StoryUpdate
from app.services import stories as stories_service

public_router = APIRouter(prefix="/stories", tags=["stories"])
business_router = APIRouter(prefix="/business/stories", tags=["stories"])


# --- consumer feed ----------------------------------------------------------


@public_router.get("", response_model=list[StoryPublic])
async def story_feed(
    db: DbSession, limit: Annotated[int, Query(ge=1, le=50)] = 30
) -> list[StoryPublic]:
    """Approved, unexpired stories, newest first."""
    rows = await stories_service.feed(db, limit=limit)
    return [StoryPublic.model_validate(row) for row in rows]


@public_router.get("/{story_id}", response_model=StoryPublic)
async def get_story(story_id: uuid.UUID, db: DbSession) -> StoryPublic:
    story = await stories_service.get_public_story(db, story_id=story_id)
    return StoryPublic.model_validate(story)


@public_router.post("/{story_id}/seen", response_model=Message)
async def mark_story_seen(story_id: uuid.UUID, db: DbSession, user: CurrentUser) -> Message:
    """Record that the signed-in user watched this story. Idempotent."""
    story = await stories_service.get_public_story(db, story_id=story_id)
    first_view = await stories_service.mark_seen(db, story=story, user_id=user.id)
    return Message(message="Recorded." if first_view else "Already seen.")


# --- partner authoring ------------------------------------------------------


@business_router.get("", response_model=list[StoryPrivate])
async def list_own_stories(
    db: DbSession,
    partner: CurrentPartner,
    review_status: Annotated[ModerationStatus | None, Query()] = None,
) -> list[StoryPrivate]:
    rows = await stories_service.list_partner_stories(
        db, partner_id=partner.id, status=review_status
    )
    return [StoryPrivate.model_validate(row) for row in rows]


@business_router.post("", response_model=StoryPrivate, status_code=status.HTTP_201_CREATED)
async def create_story(
    payload: StoryCreate, db: DbSession, partner: CurrentPartner
) -> StoryPrivate:
    story = await stories_service.create_story(db, partner=partner, data=payload.model_dump())
    return StoryPrivate.model_validate(story)


@business_router.patch("/{story_id}", response_model=StoryPrivate)
async def update_own_story(
    story_id: uuid.UUID, payload: StoryUpdate, db: DbSession, partner: CurrentPartner
) -> StoryPrivate:
    story = await stories_service.get_owned_story(db, partner=partner, story_id=story_id)
    updated = await stories_service.update_story(
        db, story=story, changes=payload.model_dump(exclude_unset=True, exclude_none=True)
    )
    return StoryPrivate.model_validate(updated)


@business_router.post("/{story_id}/submit", response_model=StoryPrivate)
async def submit_own_story(
    story_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> StoryPrivate:
    """Send the story to the moderation queue. Its 24h clock starts at approval."""
    story = await stories_service.get_owned_story(db, partner=partner, story_id=story_id)
    submitted = await stories_service.submit_story(db, partner=partner, story=story)
    return StoryPrivate.model_validate(submitted)


@business_router.post("/{story_id}/withdraw", response_model=StoryPrivate)
async def withdraw_own_story(
    story_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> StoryPrivate:
    story = await stories_service.get_owned_story(db, partner=partner, story_id=story_id)
    withdrawn = await stories_service.withdraw_story(db, story=story)
    return StoryPrivate.model_validate(withdrawn)


@business_router.delete("/{story_id}", response_model=Message)
async def delete_own_story(
    story_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> Message:
    story = await stories_service.get_owned_story(db, partner=partner, story_id=story_id)
    await stories_service.delete_story(db, story=story)
    return Message(message="Story deleted.")
