"""Recorded workouts.

A workout is a session the user starts and finishes in the app. It is separate
from `daily_steps`: steps are the passive total for a calendar day, a workout is
a deliberate activity with a duration and a distance.

Sessions no longer pay coins — see `app/services/workouts.py` for why —
so `bonus_paid` stays 0 and is kept only so old ledger rows still read.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class Workout(BaseModel):
    __tablename__ = "workouts"
    __table_args__ = (Index("ix_workouts_user_started", "user_id", "started_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    kind: Mapped[str] = mapped_column(String(20), default="walk", nullable=False)

    #: The recorded path, or None when GPS was off for this session.
    #:
    #: Shape: ``{"v": 1, "coordinates": [[lng, lat], ...], "t": [secs, ...], "dist_km": 5.4}``
    #:
    #: `coordinates` is GeoJSON order — longitude first — so it hands straight to
    #: a map library and would survive a move to PostGIS. `t` is seconds elapsed
    #: from `started_at`, not epoch millis: small integers instead of 13-digit
    #: numbers, and it stays correct against the one clock this row owns.
    #:
    #: Plain JSON rather than JSONB because the test suite runs on SQLite, and
    #: nothing here queries inside the column.
    route: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    steps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    calories_kcal: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_finished: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    #: Coins already credited for this workout. The ledger is the truth; this
    #: mirrors it so a repeated finish pays only the difference, which is zero.
    bonus_paid: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Set when the distance is implausible for the elapsed time. Flagged
    #: workouts pay nothing, exactly like flagged step days.
    is_suspicious: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
