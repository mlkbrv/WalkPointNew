"""Superadmin schemas: anti-fraud review and economy tuning."""

from __future__ import annotations

import uuid
from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import FlagSeverity, FlagStatus, FlagType
from app.schemas.common import ORMModel


class FlaggedDayPublic(BaseModel):
    """One step day awaiting review, with enough context to judge it."""

    day_id: uuid.UUID
    user_id: uuid.UUID
    user_label: str
    date: date_type
    steps: int
    coins_awarded: int
    coins_pending: int
    reason: str
    source: str


class FlaggedEventPublic(ORMModel):
    id: uuid.UUID
    event_type: FlagType
    severity: FlagSeverity
    status: FlagStatus
    user_id: uuid.UUID | None
    target_id: uuid.UUID | None
    description: str
    created_at: datetime
    reviewed_at: datetime | None


class ReviewDecision(BaseModel):
    reason: str = Field(default="", max_length=500)


class ReleaseResult(BaseModel):
    day_id: uuid.UUID
    coins_awarded: int
    balance: int


class AdjustmentResult(BaseModel):
    user_id: uuid.UUID
    amount: int
    balance: int


class EconomySettingsUpdate(BaseModel):
    """Every field optional — the admin panel patches one number at a time."""

    minimum_steps_threshold: int | None = Field(default=None, ge=0, le=100_000)
    reward_at_threshold: int | None = Field(default=None, ge=0, le=100_000)
    reward_per_extra_thousand_steps: int | None = Field(default=None, ge=0, le=100_000)
    suspicious_steps_per_day: int | None = Field(default=None, ge=1_000, le=500_000)
    hard_cap_steps_per_day: int | None = Field(default=None, ge=1_000, le=500_000)
    max_steps_per_hour: int | None = Field(default=None, ge=100, le=100_000)
    max_sync_age_days: int | None = Field(default=None, ge=0, le=90)
    coins_per_story_view: int | None = Field(default=None, ge=0, le=10_000)
    coins_per_referral: int | None = Field(default=None, ge=0, le=100_000)
    referral_activity_steps_required: int | None = Field(default=None, ge=0, le=1_000_000)
    story_lifetime_hours: int | None = Field(default=None, ge=1, le=720)
    max_stories_per_partner: int | None = Field(default=None, ge=1, le=100)


class EconomySettingsFull(ORMModel):
    minimum_steps_threshold: int
    reward_at_threshold: int
    reward_per_extra_thousand_steps: int
    suspicious_steps_per_day: int
    hard_cap_steps_per_day: int
    max_steps_per_hour: int
    max_sync_age_days: int
    coins_per_story_view: int
    coins_per_referral: int
    referral_activity_steps_required: int
    story_lifetime_hours: int
    max_stories_per_partner: int


class LedgerAdjustment(BaseModel):
    user_id: uuid.UUID
    amount: int = Field(description="Positive credits, negative debits. Never zero.")
    note: str = Field(max_length=255)
