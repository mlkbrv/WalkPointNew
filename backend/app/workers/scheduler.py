"""In-process APScheduler.

Jobs live here rather than in a separate queue: the workload is a handful of
cheap nightly passes. Move to Celery only when a job stops being cheap.
"""

from __future__ import annotations

import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings

logger = logging.getLogger("scheduler")

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone=ZoneInfo(settings.server_timezone))
    _register_jobs(_scheduler)
    _scheduler.start()
    logger.info("Scheduler started (%s)", settings.server_timezone)
    return _scheduler


def _register_jobs(scheduler: AsyncIOScheduler) -> None:
    """Job registration lands here as each feature phase is implemented."""
    from app.workers.jobs import run_daily_rollup, run_story_expiry, run_voucher_expiry

    scheduler.add_job(
        run_daily_rollup,
        trigger=CronTrigger(
            hour=settings.daily_rollup_hour, minute=settings.daily_rollup_minute
        ),
        id="daily_rollup",
        name="Settle and announce yesterday's step rewards",
        # A missed run (deploy, restart) still settles the day when it catches up,
        # and the job is idempotent because it only pays what is outstanding.
        misfire_grace_time=3600,
        coalesce=True,
        replace_existing=True,
    )

    scheduler.add_job(
        run_story_expiry,
        trigger=IntervalTrigger(minutes=15),
        id="story_expiry",
        name="Retire stories past their lifetime",
        coalesce=True,
        replace_existing=True,
    )

    scheduler.add_job(
        run_voucher_expiry,
        trigger=IntervalTrigger(hours=1),
        id="voucher_expiry",
        name="Mark vouchers expired once their coupon ends",
        coalesce=True,
        replace_existing=True,
    )


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")
