"""Step ingestion and the steps-to-coins conversion.

The mobile app reads Health Connect (Android) or Motion & Fitness (iOS) and posts
a running daily total. The client reports steps; the server decides coins.

Idempotency is structural, not defensive: ``daily_steps`` is unique per
``(user_id, date)``, the row is locked for the duration of a sync, and the award
is the *difference* between the reward for the old total and the new one. Posting
the same total ten times therefore pays exactly once.

A day flagged by :mod:`app.services.antifraud` records its steps but accrues
nothing until a superadmin releases it.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date as date_type
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, NotFound, StepCapExceeded
from app.core.time import as_aware, utcnow
from app.models.economy import DailySteps
from app.models.enums import CoinSource, FlagStatus, NotificationType
from app.models.user import User
from app.services import antifraud, economy, notifications


@dataclass
class SyncResult:
    """What one sync did, in the terms the app needs to render feedback."""

    day: DailySteps
    coins_awarded: int
    balance: int
    is_suspicious: bool
    reason: str = ""


def _server_today() -> date_type:
    return utcnow().date()


async def sync_daily_steps(
    db: AsyncSession,
    *,
    user: User,
    day: date_type,
    steps: int,
    source: str = "health_connect",
) -> SyncResult:
    """Record a daily step total and credit whatever new coins it earns.

    Raises when the report itself is unacceptable (future date, stale date, absurd
    count). A *plausible but suspicious* report is not an error — it is accepted,
    stored, and withheld from the ledger for review.
    """
    econ = await economy.get_settings_row(db)
    today = _server_today()

    if day > today:
        raise BusinessRuleError("Cannot report steps for a future date.", code="FUTURE_DATE")
    if day < today - timedelta(days=econ.max_sync_age_days):
        raise BusinessRuleError(
            f"Steps older than {econ.max_sync_age_days} days are no longer accepted.",
            code="SYNC_TOO_OLD",
        )
    if steps < 0:
        raise BusinessRuleError("Step count cannot be negative.", code="NEGATIVE_STEPS")
    if steps > econ.hard_cap_steps_per_day * 2:
        # Far beyond anything worth queueing for a human to look at.
        raise StepCapExceeded()

    existing = await db.scalar(
        select(DailySteps)
        .where(DailySteps.user_id == user.id, DailySteps.date == day)
        .with_for_update()
    )

    if existing is None:
        existing = DailySteps(user_id=user.id, date=day, steps=0, source=source)
        db.add(existing)
        await db.flush()
        # No earlier report for this day: screen the total against the whole day.
        hours_since_previous = 24.0
    else:
        last_seen = as_aware(existing.updated_at) or utcnow()
        hours_since_previous = max((utcnow() - last_seen).total_seconds() / 3600, 0.0)

    previous_steps = existing.steps

    # Step counts only ever go up within a day; a lower total is a stale client.
    if steps <= previous_steps:
        return SyncResult(
            day=existing,
            coins_awarded=0,
            balance=await economy.get_balance(db, user.id),
            is_suspicious=existing.is_suspicious,
            reason=existing.suspicion_reason,
        )

    verdict = antifraud.screen_step_report(
        steps=steps,
        previous_steps=previous_steps,
        hours_since_previous=hours_since_previous,
        econ=econ,
    )

    existing.steps = steps
    existing.source = source

    if verdict.is_suspicious:
        existing.is_suspicious = True
        existing.suspicion_reason = verdict.reason
        antifraud.raise_flag(
            db,
            user_id=user.id,
            target_id=existing.id,
            verdict=verdict,
            day=day,
            steps=steps,
        )
        await db.commit()
        await db.refresh(existing)
        return SyncResult(
            day=existing,
            coins_awarded=0,
            balance=await economy.get_balance(db, user.id),
            is_suspicious=True,
            reason=verdict.reason,
        )

    # A day already under review stays withheld even if this report looks fine.
    if existing.is_suspicious:
        await db.commit()
        await db.refresh(existing)
        return SyncResult(
            day=existing,
            coins_awarded=0,
            balance=await economy.get_balance(db, user.id),
            is_suspicious=True,
            reason=existing.suspicion_reason,
        )

    awarded = _pay_outstanding(db, day_row=existing, econ=econ)

    await db.commit()
    await db.refresh(existing)
    return SyncResult(
        day=existing,
        coins_awarded=awarded,
        balance=await economy.get_balance(db, user.id),
        is_suspicious=False,
    )


async def release_flagged_day(
    db: AsyncSession, *, day_id: uuid.UUID, reviewer_id: uuid.UUID
) -> SyncResult:
    """Superadmin approves a flagged day: clear the flag and pay what it earned."""
    day_row = await db.get(DailySteps, day_id, with_for_update=True)
    if day_row is None:
        raise NotFound("Step day not found.")
    if not day_row.is_suspicious:
        raise BusinessRuleError("This day is not flagged.", code="NOT_FLAGGED")

    econ = await economy.get_settings_row(db)

    day_row.is_suspicious = False
    day_row.suspicion_reason = ""
    # coins_awarded records what has already been paid, so this pays the remainder.
    awarded = _pay_outstanding(db, day_row=day_row, econ=econ, note_suffix=" (released after review)")

    await antifraud.close_open_flags(
        db, target_id=day_row.id, reviewer_id=reviewer_id, status=FlagStatus.APPROVED
    )

    released_note = None
    if awarded > 0:
        released_note = notifications.queue(
            db,
            user_id=day_row.user_id,
            title="Coins released",
            body=f"We reviewed your activity and credited {awarded} coins.",
            notification_type=NotificationType.COINS_AWARDED,
            data={"date": day_row.date.isoformat(), "coins": awarded},
        )

    await db.commit()
    await db.refresh(day_row)

    # Push only after the release is durable.
    if released_note is not None:
        await notifications.deliver(db, released_note)
    return SyncResult(
        day=day_row,
        coins_awarded=awarded,
        balance=await economy.get_balance(db, day_row.user_id),
        is_suspicious=False,
    )


async def reject_flagged_day(
    db: AsyncSession, *, day_id: uuid.UUID, reviewer_id: uuid.UUID, reason: str = ""
) -> DailySteps:
    """Superadmin discards a flagged day. The steps stay on record; no coins are paid.

    ``is_suspicious`` deliberately stays set: it is what stops a later sync for the
    same day from paying out the total that was just rejected. The flag is closed,
    so the day leaves the review queue.

    The account is not blocked — that stays a separate, deliberate decision.
    """
    day_row = await db.get(DailySteps, day_id, with_for_update=True)
    if day_row is None:
        raise NotFound("Step day not found.")
    if not day_row.is_suspicious:
        raise BusinessRuleError("This day is not flagged.", code="NOT_FLAGGED")

    day_row.suspicion_reason = reason or day_row.suspicion_reason
    await antifraud.close_open_flags(
        db, target_id=day_row.id, reviewer_id=reviewer_id, status=FlagStatus.REJECTED
    )
    await db.commit()
    await db.refresh(day_row)
    return day_row


def _pay_outstanding(db: AsyncSession, *, day_row: DailySteps, econ, note_suffix: str = "") -> int:
    """Pay the gap between what the day has earned and what it has already been paid.

    ``coins_awarded`` mirrors what the ledger holds for this day, so the delta is
    simply ``earned - paid``. That makes every path — a re-sync, a later sync with
    more steps, a release after review — correct without special-casing any of them,
    and never pays for the same steps twice.
    """
    earned = economy.compute_steps_reward(day_row.steps, econ)
    delta = max(earned - day_row.coins_awarded, 0)
    if delta <= 0:
        return 0

    day_row.coins_awarded += delta
    economy.record_entry(
        db,
        user_id=day_row.user_id,
        amount=delta,
        source=CoinSource.STEPS,
        note=f"{day_row.steps:,} steps on {day_row.date.isoformat()}{note_suffix}",
        reference_id=day_row.id,
    )
    return delta


async def get_day(db: AsyncSession, *, user_id: uuid.UUID, day: date_type) -> DailySteps | None:
    return await db.scalar(
        select(DailySteps).where(DailySteps.user_id == user_id, DailySteps.date == day)
    )


async def get_range(
    db: AsyncSession, *, user_id: uuid.UUID, start: date_type, end: date_type
) -> list[DailySteps]:
    rows = await db.scalars(
        select(DailySteps)
        .where(
            DailySteps.user_id == user_id,
            DailySteps.date >= start,
            DailySteps.date <= end,
        )
        .order_by(DailySteps.date.asc())
    )
    return list(rows.all())
