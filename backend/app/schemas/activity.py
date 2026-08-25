"""Leaderboard and workout schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: uuid.UUID
    name: str
    steps: int
    avatar_url: str | None
    is_self: bool


class LeaderboardSelf(BaseModel):
    #: None when the viewer has walked nothing in the period.
    rank: int | None
    steps: int


class LeaderboardResponse(BaseModel):
    period: str
    items: list[LeaderboardEntry]
    self: LeaderboardSelf


# --- workouts ---------------------------------------------------------------


class WorkoutPublic(ORMModel):
    id: uuid.UUID
    kind: str
    started_at: datetime
    finished_at: datetime | None
    duration_seconds: int
    distance_km: float
    steps: int
    calories_kcal: int
    is_finished: bool
    #: Coins this session has been credited so far.
    bonus_paid: int
    is_suspicious: bool


class WorkoutStart(BaseModel):
    kind: str = Field(default="walk", max_length=20)


class WorkoutProgress(BaseModel):
    """Every field optional: the app reports whatever it has since the last call."""

    duration_seconds: int | None = Field(default=None, ge=0, le=86_400)
    distance_km: float | None = Field(default=None, ge=0, le=500)
    steps: int | None = Field(default=None, ge=0, le=200_000)
    calories_kcal: int | None = Field(default=None, ge=0, le=50_000)


class WorkoutFinished(BaseModel):
    workout: WorkoutPublic
    coins_awarded: int
    balance: int


class WeeklySummary(BaseModel):
    sessions: float
    distance_km: float
    duration_seconds: float
    calories_kcal: float
    coins: float
