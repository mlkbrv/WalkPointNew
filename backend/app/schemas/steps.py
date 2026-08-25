"""Step sync and history schemas."""

from __future__ import annotations

import uuid
from datetime import date as date_type

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class StepSyncRequest(BaseModel):
    """A running total for one calendar day, as read from the device."""

    date: date_type
    steps: int = Field(ge=0, le=200_000)
    source: str = Field(default="health_connect", max_length=30)


class DailyStepsPublic(ORMModel):
    id: uuid.UUID
    date: date_type
    steps: int
    coins_awarded: int
    is_suspicious: bool
    suspicion_reason: str
    source: str


class StepSyncResponse(BaseModel):
    """What the sync changed. ``coins_awarded`` is this call's credit, not the day's total."""

    day: DailyStepsPublic
    coins_awarded: int
    balance: int
    is_suspicious: bool
    reason: str = ""


class StepHistoryResponse(BaseModel):
    days: list[DailyStepsPublic]
    total_steps: int
    total_coins: int


class EconomySettingsPublic(ORMModel):
    """The rules the app shows the user, so the client never restates them itself."""

    minimum_steps_threshold: int
    reward_at_threshold: int
    reward_per_extra_thousand_steps: int
    hard_cap_steps_per_day: int
    max_sync_age_days: int
