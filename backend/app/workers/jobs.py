"""Scheduled jobs.

The nightly roll-up is a *reconciliation and notification* pass, not the primary
accrual path. Coins are credited as steps arrive (see
:func:`app.services.steps.sync_daily_steps`), because a user who walks at noon
should not wait until midnight to see their balance move. The job then:

* pays any day that ended earning more than it was paid — the safety net for a
  sync that raced, failed midway, or arrived while a flag was open;
* marks the day closed, so it is never reconciled twice;
* tells the user what the day came to, including the "you were short" case that
  the sync path has no natural moment to report.
"""

from __future__ import annotations

import logging
from datetime import date as date_type
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.db.session import SessionLocal
from app.models.economy import DailySteps
from app.models.enums import CoinSource, NotificationType
from app.services import economy, notifications

logger = logging.getLogger("jobs")


async def run_daily_rollup(target_day: date_type | None = None) -> dict[str, int]:
    """Close out a day for every user who reported steps on it.

    Defaults to yesterday, so a run at 23:59 local time still settles a full day
    rather than a day in progress.
    """
    async with SessionLocal() as db:
        return await rollup_day(db, target_day or (utcnow().date() - timedelta(days=1)))


async def rollup_day(db: AsyncSession, day: date_type) -> dict[str, int]:
    econ = await economy.get_settings_row(db)

    rows = list(
        (
            await db.scalars(
                select(DailySteps).where(
                    DailySteps.date == day, DailySteps.is_rolled_up.is_(False)
                )
            )
        ).all()
    )

    stats = {"processed": 0, "paid": 0, "coins": 0, "below_threshold": 0, "withheld": 0, "pushed": 0}
    written: list = []

    for row in rows:
        stats["processed"] += 1
        row.is_rolled_up = True

        if row.is_suspicious:
            # Under review: the reviewer decides, the job does not.
            stats["withheld"] += 1
            continue

        earned = economy.compute_steps_reward(row.steps, econ)
        outstanding = max(earned - row.coins_awarded, 0)

        if outstanding > 0:
            row.coins_awarded += outstanding
            economy.record_entry(
                db,
                user_id=row.user_id,
                amount=outstanding,
                source=CoinSource.DAILY_ROLLUP,
                note=f"End-of-day settlement for {day.isoformat()}",
                reference_id=row.id,
            )
            stats["paid"] += 1
            stats["coins"] += outstanding

        if earned > 0:
            written.append(
                notifications.queue(
                    db,
                    user_id=row.user_id,
                    title=f"{earned} coins earned",
                    body=f"You walked {row.steps:,} steps on {day.isoformat()}.",
                    notification_type=NotificationType.COINS_AWARDED,
                    data={"date": day.isoformat(), "steps": row.steps, "coins": earned},
                )
            )
        else:
            stats["below_threshold"] += 1
            short_by = econ.minimum_steps_threshold - row.steps
            written.append(
                notifications.queue(
                    db,
                    user_id=row.user_id,
                    title="No coins today",
                    body=(
                        f"You walked {row.steps:,} steps — {short_by:,} short of the "
                        f"{econ.minimum_steps_threshold:,} needed to earn."
                    ),
                    notification_type=NotificationType.STEPS_MISSED,
                    data={"date": day.isoformat(), "steps": row.steps, "short_by": short_by},
                )
            )

    await db.commit()

    # One multicast per distinct message rather than one send per user.
    push_result = await notifications.deliver_many(db, written)
    stats["pushed"] = push_result.sent
    logger.info("Daily roll-up for %s: %s", day, stats)
    return stats


async def run_story_expiry() -> int:
    """Sweep approved stories whose lifetime has run out.

    The feed already filters on ``expires_at``, so this is housekeeping rather
    than the thing that keeps stale stories hidden — it returns them to the
    partner's drafts and frees their live-story allowance.
    """
    from app.services import stories as stories_service

    async with SessionLocal() as db:
        expired = await stories_service.expire_due_stories(db)
        if expired:
            logger.info("Expired %s stories", expired)
        return expired


async def run_voucher_expiry() -> int:
    """Mark vouchers expired once the coupon behind them has ended.

    The wallet already reports expiry on read, so this only keeps the stored state
    honest for reporting and for the till's refusal message.
    """
    from app.services import redemptions as redemptions_service

    async with SessionLocal() as db:
        expired = await redemptions_service.expire_due_vouchers(db)
        if expired:
            logger.info("Expired %s vouchers", expired)
        return expired
