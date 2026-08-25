"""Step ingestion and history.

The client posts a running daily total; the server owns the conversion to coins.
"""

from __future__ import annotations

from datetime import date as date_type
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.core.time import utcnow
from app.schemas.steps import (
    DailyStepsPublic,
    EconomySettingsPublic,
    StepHistoryResponse,
    StepSyncRequest,
    StepSyncResponse,
)
from app.services import economy
from app.services import steps as steps_service

router = APIRouter(prefix="/steps", tags=["steps"])


@router.post("/sync", response_model=StepSyncResponse)
async def sync_steps(
    payload: StepSyncRequest, db: DbSession, user: CurrentUser
) -> StepSyncResponse:
    """Report the day's step total.

    Safe to call repeatedly: the award is the difference against what the day has
    already paid, so re-posting the same total credits nothing.
    """
    result = await steps_service.sync_daily_steps(
        db, user=user, day=payload.date, steps=payload.steps, source=payload.source
    )
    return StepSyncResponse(
        day=DailyStepsPublic.model_validate(result.day),
        coins_awarded=result.coins_awarded,
        balance=result.balance,
        is_suspicious=result.is_suspicious,
        reason=result.reason,
    )


@router.get("/today", response_model=DailyStepsPublic | None)
async def steps_today(db: DbSession, user: CurrentUser) -> DailyStepsPublic | None:
    day = await steps_service.get_day(db, user_id=user.id, day=utcnow().date())
    return DailyStepsPublic.model_validate(day) if day else None


@router.get("/history", response_model=StepHistoryResponse)
async def steps_history(
    db: DbSession,
    user: CurrentUser,
    days: Annotated[int, Query(ge=1, le=365)] = 30,
    end: Annotated[date_type | None, Query()] = None,
) -> StepHistoryResponse:
    end_date = end or utcnow().date()
    start_date = end_date - timedelta(days=days - 1)

    rows = await steps_service.get_range(db, user_id=user.id, start=start_date, end=end_date)
    return StepHistoryResponse(
        days=[DailyStepsPublic.model_validate(row) for row in rows],
        total_steps=sum(row.steps for row in rows),
        total_coins=sum(row.coins_awarded for row in rows),
    )


@router.get("/rules", response_model=EconomySettingsPublic)
async def steps_rules(db: DbSession, user: CurrentUser) -> EconomySettingsPublic:
    """The live reward rules, so the app never hardcodes a threshold of its own."""
    econ = await economy.get_settings_row(db)
    await db.commit()
    return EconomySettingsPublic.model_validate(econ)
