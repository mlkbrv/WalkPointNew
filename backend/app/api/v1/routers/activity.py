"""Leaderboard and workout tracking."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.activity import (
    LeaderboardEntry,
    LeaderboardResponse,
    LeaderboardSelf,
    WeeklySummary,
    WorkoutDetail,
    WorkoutFinished,
    WorkoutProgress,
    WorkoutPublic,
    WorkoutStart,
)
from app.services import leaderboard as leaderboard_service
from app.services import workouts as workouts_service

leaderboard_router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])
workouts_router = APIRouter(prefix="/workouts", tags=["workouts"])


@leaderboard_router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    db: DbSession,
    user: CurrentUser,
    period: Annotated[str, Query(pattern="^(daily|weekly)$")] = "daily",
) -> LeaderboardResponse:
    """Ranking by steps. Days withheld for fraud review do not count.

    The viewer always gets their own rank in `self`, even when they are outside
    the listed top — the board is a motivator, and hiding someone's own position
    from them defeats it.
    """
    result = await leaderboard_service.build(db, period=period, viewer=user)
    return LeaderboardResponse(
        period=result.period,
        items=[LeaderboardEntry(**row.__dict__) for row in result.items],
        self=LeaderboardSelf(rank=result.self_rank, steps=result.self_steps),
    )


# --- workouts ---------------------------------------------------------------


@workouts_router.post("", response_model=WorkoutPublic, status_code=status.HTTP_201_CREATED)
async def start_workout(
    payload: WorkoutStart, db: DbSession, user: CurrentUser
) -> WorkoutPublic:
    """Open a session. Calling it twice returns the open one rather than a duplicate."""
    workout = await workouts_service.start(db, user=user, kind=payload.kind)
    return WorkoutPublic.model_validate(workout)


@workouts_router.get("/active", response_model=WorkoutPublic | None)
async def active_workout(db: DbSession, user: CurrentUser) -> WorkoutPublic | None:
    """The session still running, if the app was closed mid-workout."""
    workout = await workouts_service.active(db, user_id=user.id)
    return WorkoutPublic.model_validate(workout) if workout else None


@workouts_router.get("/last", response_model=WorkoutPublic | None)
async def last_workout(db: DbSession, user: CurrentUser) -> WorkoutPublic | None:
    workout = await workouts_service.latest(db, user_id=user.id)
    return WorkoutPublic.model_validate(workout) if workout else None


@workouts_router.get("/summary", response_model=WeeklySummary)
async def weekly_summary(db: DbSession, user: CurrentUser) -> WeeklySummary:
    return WeeklySummary(**await workouts_service.weekly_summary(db, user_id=user.id))


@workouts_router.get("", response_model=list[WorkoutPublic])
async def workout_history(
    db: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[WorkoutPublic]:
    rows = await workouts_service.history(db, user_id=user.id, limit=limit)
    return [WorkoutPublic.model_validate(row) for row in rows]


@workouts_router.get("/{workout_id}", response_model=WorkoutDetail)
async def workout_detail(
    workout_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> WorkoutDetail:
    """One workout, including its recorded path.

    Declared **after** `/active`, `/last` and `/summary`: FastAPI matches routes
    in order, so a path parameter placed above them would swallow all three and
    they would start failing UUID parsing instead of answering.
    """
    workout = await workouts_service.get_owned(db, user_id=user.id, workout_id=workout_id)
    return WorkoutDetail.model_validate(workout)


@workouts_router.patch("/{workout_id}", response_model=WorkoutPublic)
async def update_workout(
    workout_id: uuid.UUID, payload: WorkoutProgress, db: DbSession, user: CurrentUser
) -> WorkoutPublic:
    """Report progress mid-session. Values only move forward."""
    workout = await workouts_service.get_owned(db, user_id=user.id, workout_id=workout_id)
    updated = await workouts_service.update_progress(
        db,
        workout=workout,
        duration_seconds=payload.duration_seconds,
        distance_km=payload.distance_km,
        steps=payload.steps,
        calories_kcal=payload.calories_kcal,
        route=payload.route.model_dump() if payload.route else None,
    )
    return WorkoutPublic.model_validate(updated)


@workouts_router.post("/{workout_id}/finish", response_model=WorkoutFinished)
async def finish_workout(
    workout_id: uuid.UUID, payload: WorkoutProgress, db: DbSession, user: CurrentUser
) -> WorkoutFinished:
    """Close the session and pay the bonus.

    Idempotent: finishing twice credits the difference, which is nothing.
    """
    workout = await workouts_service.get_owned(db, user_id=user.id, workout_id=workout_id)
    updated, awarded, balance = await workouts_service.finish(
        db,
        user=user,
        workout=workout,
        duration_seconds=payload.duration_seconds,
        distance_km=payload.distance_km,
        steps=payload.steps,
        calories_kcal=payload.calories_kcal,
        route=payload.route.model_dump() if payload.route else None,
    )
    return WorkoutFinished(
        workout=WorkoutPublic.model_validate(updated),
        coins_awarded=awarded,
        balance=balance,
    )
