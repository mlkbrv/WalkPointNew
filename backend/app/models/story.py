"""Partner stories — Instagram-style, moderated, and expiring after a fixed lifetime."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel
from app.models.enums import ModerationStatus, StoryMediaType


class Story(BaseModel):
    __tablename__ = "stories"
    __table_args__ = (Index("ix_stories_status_expires", "status", "expires_at"),)

    partner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False
    )
    media_type: Mapped[StoryMediaType] = mapped_column(String(10), nullable=False)
    media_path: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str] = mapped_column(Text, default="", nullable=False)

    status: Mapped[ModerationStatus] = mapped_column(
        String(20), default=ModerationStatus.PENDING, nullable=False
    )
    rejection_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StoryView(BaseModel):
    """One row per (story, user). Also gates the one-time story-view coin reward."""

    __tablename__ = "story_views"
    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_story_views_story_user"),)

    story_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    coin_awarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
