"""The step leaderboard.

Ranks users by steps over a period, computed from `daily_steps` — the same rows
the economy pays out on, so the board and the wallet can never tell different
stories about how far somebody walked.

Two rules that shape the query:

* **Flagged days do not count.** A day withheld from the ledger for review must
  not buy a place on the board either, or the leaderboard becomes the one place
  where faking steps still pays.
* **Everyone sees their own rank**, even when they are far down the list or have
  opted out of being listed. The board is a motivator; hiding someone's own
  position from them defeats the point.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date as date_type
from datetime import timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.models.economy import DailySteps
from app.models.user import User

TOP_N = 50


@dataclass
class LeaderboardRow:
    rank: int
    user_id: uuid.UUID
    name: str
    steps: int
    avatar_url: str | None
    is_self: bool


@dataclass
class LeaderboardResult:
    period: str
    items: list[LeaderboardRow]
    self_rank: int | None
    self_steps: int


def _window(period: str) -> tuple[date_type, date_type]:
    """Inclusive date range for the period, in server time."""
    today = utcnow().date()
    if period == "weekly":
        # Monday of the current week through today.
        return today - timedelta(days=today.weekday()), today
    return today, today


def _totals_query(start: date_type, end: date_type) -> Select:
    """Steps per user over the window, excluding days under fraud review."""
    return (
        select(
            DailySteps.user_id.label("user_id"),
            func.sum(DailySteps.steps).label("total_steps"),
        )
        .where(
            DailySteps.date >= start,
            DailySteps.date <= end,
            # A flagged day earns nothing and ranks nothing.
            DailySteps.is_suspicious.is_(False),
        )
        .group_by(DailySteps.user_id)
    )


async def build(
    db: AsyncSession, *, period: str, viewer: User, limit: int = TOP_N
) -> LeaderboardResult:
    period = "weekly" if period == "weekly" else "daily"
    start, end = _window(period)

    totals = _totals_query(start, end).subquery()

    rows = await db.execute(
        select(
            totals.c.user_id,
            totals.c.total_steps,
            User.full_name,
            User.email,
            User.phone,
            User.avatar_path,
        )
        .join(User, User.id == totals.c.user_id)
        .where(User.is_active.is_(True), User.is_blocked.is_(False))
        .order_by(totals.c.total_steps.desc(), User.created_at.asc())
        .limit(limit)
    )

    items: list[LeaderboardRow] = []
    self_rank: int | None = None

    for position, row in enumerate(rows.all(), start=1):
        is_self = row.user_id == viewer.id
        if is_self:
            self_rank = position
        items.append(
            LeaderboardRow(
                rank=position,
                user_id=row.user_id,
                name=_display_name(row.full_name, row.email, row.phone),
                steps=int(row.total_steps or 0),
                avatar_url=row.avatar_path,
                is_self=is_self,
            )
        )

    self_steps = await db.scalar(
        select(func.coalesce(func.sum(DailySteps.steps), 0)).where(
            DailySteps.user_id == viewer.id,
            DailySteps.date >= start,
            DailySteps.date <= end,
            DailySteps.is_suspicious.is_(False),
        )
    )
    self_steps = int(self_steps or 0)

    # Outside the top N: count how many people are genuinely ahead.
    if self_rank is None and self_steps > 0:
        ahead = await db.scalar(
            select(func.count()).select_from(
                _totals_query(start, end)
                .having(func.sum(DailySteps.steps) > self_steps)
                .subquery()
            )
        )
        self_rank = int(ahead or 0) + 1

    return LeaderboardResult(
        period=period, items=items, self_rank=self_rank, self_steps=self_steps
    )


def _display_name(full_name: str, email: str | None, phone: str | None) -> str:
    """A name for the board that never leaks a full email or phone number.

    The leaderboard is public to every signed-in user, so `sam@example.com`
    becomes `Sam` and a phone number becomes its last four digits.
    """
    if full_name.strip():
        return full_name.strip()
    if email:
        return email.split("@")[0][:20].title()
    if phone:
        return f"Walker {phone[-4:]}"
    return "Walker"
