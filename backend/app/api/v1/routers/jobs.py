"""HTTP trigger for the scheduled jobs.

On a single server the jobs belong in the `worker` service (see
`app/worker.py`), and this endpoint is unnecessary. It exists for hosts where a
second always-on process is not available — a free managed tier, or anywhere you
would rather drive the schedule from system cron or an external pinger:

    0 23 * * *  curl -fsS -X POST -H "X-Cron-Key: $KEY" https://api.example.com/v1/jobs/daily-rollup/run

**Disabled unless `CRON_SECRET` is set**, and answering 404 rather than 403 when
it is not — an endpoint that announces itself as "here but locked" is an
invitation to guess at the key.

Authentication is a shared secret, not a JWT: cron cannot sign in, and giving a
scheduler a long-lived staff token would be worse. The comparison is
constant-time so the response cannot be used to recover the key a byte at a time.

The jobs run on the **request's** session rather than opening their own. A free
Postgres tier has a small connection cap, and a second pool for something already
inside a request is the wrong way to spend it.
"""

from __future__ import annotations

import logging
import secrets
from datetime import date as date_type
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Header, Query

from app.core.config import settings
from app.core.deps import DbSession
from app.core.errors import NotFound, Unauthorized
from app.core.time import utcnow
from app.schemas.jobs import JobResult

logger = logging.getLogger("jobs")

router = APIRouter(prefix="/jobs", tags=["admin"])


def _authorise(provided: str | None) -> None:
    if not settings.cron_secret:
        raise NotFound("Not found.")
    if not provided or not secrets.compare_digest(provided, settings.cron_secret):
        raise Unauthorized("Invalid cron key.", code="INVALID_CRON_KEY")


@router.post("/daily-rollup/run", response_model=JobResult)
async def run_daily_rollup(
    db: DbSession,
    x_cron_key: Annotated[str | None, Header()] = None,
    day: Annotated[date_type | None, Query(description="Defaults to yesterday.")] = None,
) -> JobResult:
    """Settle a day's step rewards and send the earned / fell-short notifications.

    Idempotent: a day is only rolled up once, and the pass pays whatever a sync
    left outstanding rather than paying again. Safe to call twice, and safe to
    call late — pass `day` to catch up on one that was missed.
    """
    _authorise(x_cron_key)

    from app.workers.jobs import rollup_day

    target = day or (utcnow().date() - timedelta(days=1))
    stats = await rollup_day(db, target)
    logger.info("Roll-up triggered over HTTP for %s: %s", target, stats)
    return JobResult(job="daily-rollup", stats=stats)


@router.post("/story-expiry/run", response_model=JobResult)
async def run_story_expiry(
    db: DbSession, x_cron_key: Annotated[str | None, Header()] = None
) -> JobResult:
    """Retire stories past their lifetime. The feed already filters them out."""
    _authorise(x_cron_key)

    from app.services import stories as stories_service

    return JobResult(
        job="story-expiry", stats={"expired": await stories_service.expire_due_stories(db)}
    )


@router.post("/voucher-expiry/run", response_model=JobResult)
async def run_voucher_expiry(
    db: DbSession, x_cron_key: Annotated[str | None, Header()] = None
) -> JobResult:
    """Mark vouchers expired once the coupon behind them has ended."""
    _authorise(x_cron_key)

    from app.services import redemptions as redemptions_service

    return JobResult(
        job="voucher-expiry",
        stats={"expired": await redemptions_service.expire_due_vouchers(db)},
    )
