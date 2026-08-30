"""Leaderboard and workout schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

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


class WorkoutRoute(BaseModel):
    """A recorded path.

    `coordinates` is GeoJSON order — **longitude first** — so it hands straight
    to a map library without a transform and would survive a move to PostGIS.
    Getting that order wrong is the classic footgun here, hence the explicit
    range check below rather than a bare list of floats.

    `t` is seconds elapsed from the workout's `started_at`, not epoch millis:
    small integers rather than 13-digit numbers, and correct against the one
    clock this row owns.

    The caps are the reason this is a model at all. A one-hour walk sampled every
    five metres is roughly 1000 points; 10 000 is a generous ceiling that still
    bounds the row and the response.
    """

    v: int = 1
    coordinates: list[tuple[float, float]] = Field(default_factory=list, max_length=10_000)
    t: list[int] = Field(default_factory=list, max_length=10_000)
    #: Distance before simplification, so a thinned polyline does not shrink the
    #: number shown to the user.
    dist_km: float = Field(default=0.0, ge=0, le=500)

    @model_validator(mode="after")
    def _consistent(self) -> WorkoutRoute:
        if len(self.t) != len(self.coordinates):
            raise ValueError("t and coordinates must be the same length")
        for lng, lat in self.coordinates:
            if not (-180 <= lng <= 180 and -90 <= lat <= 90):
                raise ValueError("coordinate out of range (expected [longitude, latitude])")
        return self


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
    #: Always 0 — sessions stopped paying. Kept so old clients still parse.
    bonus_paid: int
    is_suspicious: bool


class WorkoutDetail(WorkoutPublic):
    """One workout, with its path.

    Separate from `WorkoutPublic` on purpose: `GET /v1/workouts?limit=30` returns
    a list, and thirty routes at a few KB each is a quarter of a megabyte over
    mobile data for a screen that only draws rows. The route is fetched when a
    single workout is opened.
    """

    route: WorkoutRoute | None = None


class WorkoutStart(BaseModel):
    kind: str = Field(default="walk", max_length=20)


class WorkoutProgress(BaseModel):
    """Every field optional: the app reports whatever it has since the last call."""

    duration_seconds: int | None = Field(default=None, ge=0, le=86_400)
    distance_km: float | None = Field(default=None, ge=0, le=500)
    steps: int | None = Field(default=None, ge=0, le=200_000)
    calories_kcal: int | None = Field(default=None, ge=0, le=50_000)
    #: Sent on finish, not on every progress ping — see `WorkoutRoute`.
    route: WorkoutRoute | None = None


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
