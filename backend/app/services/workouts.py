"""Workout sessions and the bonus finishing one pays.

The bonus formula comes from the product spec::

    bonus = max(180, floor(distance_km * 65))

Paid once, on finish, and only if the session looks real. The same anti-fraud
stance as step syncing applies: an implausible session is flagged and pays
nothing, but the account is never blocked for it.

A workout's distance does **not** feed the coin ledger twice — steps walked
during it still count toward the day through `daily_steps`. The bonus is a
separate reward for completing a tracked session, which is why it is a flat
formula rather than a per-step rate.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.time import utcnow
from app.models.enums import CoinSource, NotificationType
from app.models.user import User
from app.models.workout import Workout
from app.services import economy, notifications

MIN_BONUS = 180
COINS_PER_KM = 65

#: Above this the session is not a walk or a run any more. Used only to flag for
#: review, never to reject — a cyclist logging a "walk" is a data problem, not fraud.
MAX_PLAUSIBLE_KMH = 25.0

#: Below this a "workout" is someone tapping start and stop.
MIN_DURATION_SECONDS = 60


def compute_bonus(distance_km: float) -> int:
    """Coins for finishing a session. Flat floor, then per-kilometre."""
    return max(MIN_BONUS, int(distance_km * COINS_PER_KM))


def screen(duration_seconds: int, distance_km: float) -> tuple[bool, str]:
    """Return ``(is_suspicious, reason)`` for a finished session."""
    if duration_seconds <= 0:
        return True, "Session has no duration."

    hours = duration_seconds / 3600
    speed = distance_km / hours if hours > 0 else 0

    if speed > MAX_PLAUSIBLE_KMH:
        return True, (
            f"{distance_km:.2f} km in {duration_seconds // 60} min "
            f"({speed:.1f} km/h) is faster than a person walks or runs."
        )
    return False, ""


async def start(db: AsyncSession, *, user: User, kind: str = "walk") -> Workout:
    """Open a session. An already-open one is returned rather than duplicated."""
    existing = await db.scalar(
        select(Workout)
        .where(Workout.user_id == user.id, Workout.is_finished.is_(False))
        .order_by(Workout.started_at.desc())
        .limit(1)
    )
    if existing is not None:
        return existing

    workout = Workout(user_id=user.id, kind=kind, started_at=utcnow())
    db.add(workout)
    await db.commit()
    await db.refresh(workout)
    return workout


async def get_owned(db: AsyncSession, *, user_id: uuid.UUID, workout_id: uuid.UUID) -> Workout:
    workout = await db.scalar(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == user_id)
    )
    if workout is None:
        raise NotFound("Workout not found.")
    return workout


async def update_progress(
    db: AsyncSession,
    *,
    workout: Workout,
    duration_seconds: int | None = None,
    distance_km: float | None = None,
    steps: int | None = None,
    calories_kcal: int | None = None,
) -> Workout:
    """Store progress mid-session. Values only ever move forward."""
    if workout.is_finished:
        raise Conflict("This workout is already finished.", code="ALREADY_FINISHED")

    if duration_seconds is not None:
        workout.duration_seconds = max(workout.duration_seconds, duration_seconds)
    if distance_km is not None:
        workout.distance_km = max(workout.distance_km, distance_km)
    if steps is not None:
        workout.steps = max(workout.steps, steps)
    if calories_kcal is not None:
        workout.calories_kcal = max(workout.calories_kcal, calories_kcal)

    await db.commit()
    await db.refresh(workout)
    return workout


async def finish(
    db: AsyncSession,
    *,
    user: User,
    workout: Workout,
    duration_seconds: int | None = None,
    distance_km: float | None = None,
    steps: int | None = None,
    calories_kcal: int | None = None,
) -> tuple[Workout, int, int]:
    """Close the session and pay the bonus. Returns ``(workout, awarded, balance)``.

    Idempotent: `bonus_paid` mirrors the ledger, so finishing twice pays the
    difference, which is nothing.
    """
    if duration_seconds is not None:
        workout.duration_seconds = max(workout.duration_seconds, duration_seconds)
    if distance_km is not None:
        workout.distance_km = max(workout.distance_km, distance_km)
    if steps is not None:
        workout.steps = max(workout.steps, steps)
    if calories_kcal is not None:
        workout.calories_kcal = max(workout.calories_kcal, calories_kcal)

    if workout.duration_seconds < MIN_DURATION_SECONDS:
        raise BusinessRuleError(
            f"A session must run for at least {MIN_DURATION_SECONDS} seconds to count.",
            code="WORKOUT_TOO_SHORT",
        )

    suspicious, reason = screen(workout.duration_seconds, workout.distance_km)

    if not workout.is_finished:
        workout.is_finished = True
        workout.finished_at = utcnow()

    workout.is_suspicious = workout.is_suspicious or suspicious

    awarded = 0
    note = None

    if not workout.is_suspicious:
        earned = compute_bonus(workout.distance_km)
        awarded = max(earned - workout.bonus_paid, 0)
        if awarded > 0:
            workout.bonus_paid += awarded
            economy.record_entry(
                db,
                user_id=user.id,
                amount=awarded,
                source=CoinSource.WORKOUT_BONUS,
                note=f"{workout.distance_km:.2f} km workout",
                reference_id=workout.id,
            )
            note = notifications.queue(
                db,
                user_id=user.id,
                title=f"{awarded} coins for your workout",
                body=f"{workout.distance_km:.2f} km in {workout.duration_seconds // 60} minutes.",
                notification_type=NotificationType.COINS_AWARDED,
                data={"workout_id": str(workout.id), "coins": awarded},
            )

    await db.commit()
    await db.refresh(workout)

    if note is not None:
        await notifications.deliver(db, note)

    return workout, awarded, await economy.get_balance(db, user.id)


async def history(
    db: AsyncSession, *, user_id: uuid.UUID, limit: int = 30
) -> list[Workout]:
    rows = await db.scalars(
        select(Workout)
        .where(Workout.user_id == user_id, Workout.is_finished.is_(True))
        .order_by(Workout.started_at.desc())
        .limit(limit)
    )
    return list(rows.all())


async def latest(db: AsyncSession, *, user_id: uuid.UUID) -> Workout | None:
    return await db.scalar(
        select(Workout)
        .where(Workout.user_id == user_id, Workout.is_finished.is_(True))
        .order_by(Workout.finished_at.desc())
        .limit(1)
    )


async def active(db: AsyncSession, *, user_id: uuid.UUID) -> Workout | None:
    return await db.scalar(
        select(Workout)
        .where(Workout.user_id == user_id, Workout.is_finished.is_(False))
        .order_by(Workout.started_at.desc())
        .limit(1)
    )


async def weekly_summary(db: AsyncSession, *, user_id: uuid.UUID) -> dict[str, float]:
    """Totals for the performance screen, over the last seven days."""
    since = utcnow() - timedelta(days=7)
    rows = await db.scalars(
        select(Workout).where(
            Workout.user_id == user_id,
            Workout.is_finished.is_(True),
            Workout.finished_at >= since,
        )
    )
    sessions = list(rows.all())

    return {
        "sessions": len(sessions),
        "distance_km": round(sum(w.distance_km for w in sessions), 2),
        "duration_seconds": sum(w.duration_seconds for w in sessions),
        "calories_kcal": sum(w.calories_kcal for w in sessions),
        "coins": sum(w.bonus_paid for w in sessions),
    }

