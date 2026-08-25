"""Coupon and story schemas, for partners, staff, and consumers."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ModerationStatus, StoryMediaType
from app.schemas.common import ORMModel

# --- coupons ----------------------------------------------------------------


class CouponCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=5000)
    rules: str = Field(default="", max_length=5000)
    image_path: str | None = Field(default=None, max_length=500)
    category_id: uuid.UUID | None = None
    cost_coins: int = Field(ge=1, le=1_000_000)
    quantity_total: int = Field(ge=1, le=1_000_000)
    is_single_use: bool = True
    starts_at: datetime
    ends_at: datetime


class CouponUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    rules: str | None = Field(default=None, max_length=5000)
    image_path: str | None = Field(default=None, max_length=500)
    category_id: uuid.UUID | None = None
    cost_coins: int | None = Field(default=None, ge=1, le=1_000_000)
    quantity_total: int | None = Field(default=None, ge=1, le=1_000_000)
    is_single_use: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class CouponPublic(ORMModel):
    """The consumer view — no moderation internals leak here."""

    id: uuid.UUID
    partner_id: uuid.UUID
    category_id: uuid.UUID | None
    title: str
    description: str
    rules: str
    image_path: str | None
    cost_coins: int
    quantity_remaining: int
    is_single_use: bool
    starts_at: datetime
    ends_at: datetime


class CouponPrivate(CouponPublic):
    """The partner and staff view, including where it sits in review."""

    status: ModerationStatus
    rejection_reason: str
    quantity_total: int
    quantity_redeemed: int
    published_at: datetime | None
    reviewed_at: datetime | None
    created_at: datetime


class CouponCategoryPublic(ORMModel):
    id: uuid.UUID
    name: str
    icon: str


# --- stories ----------------------------------------------------------------


class StoryCreate(BaseModel):
    media_type: StoryMediaType
    media_path: str = Field(min_length=1, max_length=500)
    caption: str = Field(default="", max_length=2000)


class StoryUpdate(BaseModel):
    media_type: StoryMediaType | None = None
    media_path: str | None = Field(default=None, min_length=1, max_length=500)
    caption: str | None = Field(default=None, max_length=2000)


class StoryPublic(ORMModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    media_type: StoryMediaType
    media_path: str
    caption: str
    published_at: datetime | None
    expires_at: datetime | None


class StoryPrivate(StoryPublic):
    status: ModerationStatus
    rejection_reason: str
    reviewed_at: datetime | None
    created_at: datetime


# --- moderation -------------------------------------------------------------


class RejectionRequest(BaseModel):
    """A rejection must carry a reason; the partner reads it verbatim."""

    reason: str = Field(min_length=3, max_length=500)


class ModerationQueue(BaseModel):
    partners: int
    coupons: int
    stories: int
    flagged_steps: int
    support_tickets: int = 0
