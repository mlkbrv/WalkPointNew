"""The coin economy: the reward curve, the ledger, and the tunable settings row.

Two rules govern everything here and must never be worked around:

1. **The ledger is append-only.** A balance is ``SUM(coin_transactions.amount)``.
   There is no stored balance column, so a balance cannot drift out of sync with
   its history, and a correction is a new entry rather than an edit.
2. **Coins are awarded as a delta.** Re-reporting the same day must never pay
   twice, so callers compute ``reward(new_steps) - reward(old_steps)``.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economy import CoinTransaction, EconomySettings
from app.models.enums import CoinSource


async def get_settings_row(db: AsyncSession) -> EconomySettings:
    """Return the singleton settings row, creating it with defaults on first use.

    Every tunable number lives here so rates change from the admin panel rather
    than through a deploy. Never hardcode a threshold or rate in business logic.
    """
    settings_row = await db.scalar(select(EconomySettings).limit(1))
    if settings_row is None:
        settings_row = EconomySettings()
        db.add(settings_row)
        await db.flush()
    return settings_row


def compute_steps_reward(steps: int, econ: EconomySettings) -> int:
    """Coins earned for a whole day of ``steps``.

    Below the threshold the day pays nothing at all — that is the product rule,
    not a rounding artefact. At or above it, a flat reward plus a per-thousand
    bonus for everything over the threshold::

        4_999 steps -> 0
        5_000 steps -> 50
        7_000 steps -> 50 + 2 * 10 = 70

    The hard cap bounds what any single day can ever pay, so an implausible
    report that slips past the anti-fraud checks still cannot drain the economy.
    """
    if steps < econ.minimum_steps_threshold:
        return 0

    capped_steps = min(steps, econ.hard_cap_steps_per_day)
    extra_thousands = (capped_steps - econ.minimum_steps_threshold) // 1000
    return econ.reward_at_threshold + extra_thousands * econ.reward_per_extra_thousand_steps


async def get_balance(db: AsyncSession, user_id: uuid.UUID) -> int:
    """The user's coin balance: the sum of their ledger, nothing else."""
    total = await db.scalar(
        select(func.coalesce(func.sum(CoinTransaction.amount), 0)).where(
            CoinTransaction.user_id == user_id
        )
    )
    return int(total or 0)


def record_entry(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    amount: int,
    source: CoinSource,
    note: str = "",
    reference_id: uuid.UUID | None = None,
) -> CoinTransaction:
    """Append one ledger entry. Positive credits, negative debits.

    Does not commit — the caller owns the transaction, because entries are almost
    always written alongside the state change that justifies them.
    """
    entry = CoinTransaction(
        user_id=user_id,
        amount=amount,
        source=source,
        note=note[:255],
        reference_id=reference_id,
    )
    db.add(entry)
    return entry
