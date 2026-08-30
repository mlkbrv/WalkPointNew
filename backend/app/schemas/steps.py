"""Step sync and history schemas."""

from __future__ import annotations

import uuid
from datetime import date as date_type
from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class StepSource(StrEnum):
    """Where a step count actually came from.

    This was a free-text field defaulting to `"health_connect"`, so every sync
    claimed that origin no matter what produced the number — and for a long time
    nothing did, because the client read a raw sensor and posted the default.
    Constraining it means the stored provenance is a fact rather than a guess,
    and lets an operator tell a background-counted total from one that only
    accumulated while the app was open.
    """

    #: Android Health Connect: counts with the app closed.
    HEALTH_CONNECT = "health_connect"
    #: iOS Core Motion: also counts with the app closed.
    CORE_MOTION = "core_motion"
    #: Raw step sensor, foreground only — an undercount by construction.
    PEDOMETER_FOREGROUND = "pedometer_foreground"
    #: Entered or corrected by a human.
    MANUAL = "manual"
    #: The client did not say. Better recorded as unknown than as a plausible
    #: guess — which is exactly how the old `"health_connect"` default became a
    #: field full of claims nobody had made.
    UNKNOWN = "unknown"


class StepSyncRequest(BaseModel):
    """A running total for one calendar day, as read from the device."""

    date: date_type
    steps: int = Field(ge=0, le=200_000)
    source: StepSource = StepSource.UNKNOWN


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
