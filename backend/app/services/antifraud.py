"""Anti-fraud checks on reported step counts.

Steps arrive from Health Connect on the user's own device, so they are trivially
forgeable. The policy here is deliberately conservative in one direction only:

* a report that looks implausible is **flagged and withheld**, never rejected
  outright and never used to block the account — a legitimate marathon walker
  must not lose their account to a heuristic;
* a human superadmin reviews the flag and either releases the coins or discards
  the day.

Nothing in this module writes to the ledger. It only decides whether a day is
allowed to accrue automatically.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.models.audit import FlaggedEvent
from app.models.economy import DailySteps, EconomySettings
from app.models.enums import FlagSeverity, FlagStatus, FlagType

# A day that has already elapsed cannot have gained steps in fewer hours than it had.
HOURS_IN_DAY = 24


@dataclass(frozen=True)
class FraudVerdict:
    """Outcome of screening one step report."""

    is_suspicious: bool
    reason: str = ""
    flag_type: FlagType | None = None
    severity: FlagSeverity = FlagSeverity.LOW

    @property
    def is_clean(self) -> bool:
        return not self.is_suspicious


def screen_step_report(
    *,
    steps: int,
    previous_steps: int,
    hours_since_previous: float,
    econ: EconomySettings,
) -> FraudVerdict:
    """Decide whether a reported daily total may accrue coins automatically.

    Two independent signals:

    * **Implausible total** — more steps in one day than a human plausibly walks
      (``suspicious_steps_per_day``, default 35 000).
    * **Implausible rate** — the increase since the previous report for this day
      implies a pace above ``max_steps_per_hour``. A first report for a day is
      screened against the whole elapsed day rather than a rate, since there is
      no earlier point to measure from.
    """
    if steps >= econ.suspicious_steps_per_day:
        severity = (
            FlagSeverity.HIGH if steps >= econ.hard_cap_steps_per_day else FlagSeverity.MEDIUM
        )
        return FraudVerdict(
            is_suspicious=True,
            reason=(
                f"Reported {steps:,} steps in one day, at or above the plausibility "
                f"limit of {econ.suspicious_steps_per_day:,}."
            ),
            flag_type=FlagType.IMPLAUSIBLE_DAILY_STEPS,
            severity=severity,
        )

    delta = steps - previous_steps
    if delta > 0:
        # Guard the divisor: a burst of syncs seconds apart must not read as an
        # infinite rate, but it also must not be excused as a full day's walking.
        window_hours = max(hours_since_previous, 0.25)
        rate = delta / window_hours
        if rate > econ.max_steps_per_hour:
            return FraudVerdict(
                is_suspicious=True,
                reason=(
                    f"{delta:,} steps appeared in {window_hours:.2f}h "
                    f"({rate:,.0f} steps/h), above the limit of "
                    f"{econ.max_steps_per_hour:,} steps/h."
                ),
                flag_type=FlagType.STEP_SPIKE,
                severity=FlagSeverity.MEDIUM,
            )

    return FraudVerdict(is_suspicious=False)


def raise_flag(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    target_id: uuid.UUID | None,
    verdict: FraudVerdict,
    day: date_type,
    steps: int,
) -> FlaggedEvent:
    """Queue a flag for human review. Does not commit."""
    event = FlaggedEvent(
        event_type=verdict.flag_type or FlagType.IMPLAUSIBLE_DAILY_STEPS,
        severity=verdict.severity,
        status=FlagStatus.OPEN,
        user_id=user_id,
        target_id=target_id,
        description=verdict.reason,
        event_metadata={"date": day.isoformat(), "steps": steps},
    )
    db.add(event)
    return event


async def close_open_flags(
    db: AsyncSession,
    *,
    target_id: uuid.UUID,
    reviewer_id: uuid.UUID | None,
    status: FlagStatus,
) -> int:
    """Resolve every open flag pointing at ``target_id``. Returns how many were closed."""
    events = await db.scalars(
        select(FlaggedEvent).where(
            FlaggedEvent.target_id == target_id,
            FlaggedEvent.status == FlagStatus.OPEN,
        )
    )
    now = utcnow()
    closed = 0
    for event in events:
        event.status = status
        event.reviewed_by_id = reviewer_id
        event.reviewed_at = now
        closed += 1
    return closed


async def count_open_flags(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    rows = await db.scalars(
        select(FlaggedEvent.id).where(
            FlaggedEvent.user_id == user_id, FlaggedEvent.status == FlagStatus.OPEN
        )
    )
    return len(rows.all())


async def suspicious_days(db: AsyncSession, *, limit: int = 50) -> list[DailySteps]:
    """Step days awaiting review, oldest first.

    Keyed on an **open flag**, not on ``DailySteps.is_suspicious``: a rejected day
    keeps its ``is_suspicious`` mark forever — that is what stops a later sync from
    quietly paying it out — but it must not reappear in the reviewer's queue.
    """
    rows = await db.scalars(
        select(DailySteps)
        .join(FlaggedEvent, FlaggedEvent.target_id == DailySteps.id)
        .where(FlaggedEvent.status == FlagStatus.OPEN)
        .order_by(DailySteps.date.asc())
        .limit(limit)
    )
    return list(rows.unique().all())
