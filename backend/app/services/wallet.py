"""Wallet reads: balance and the paginated ledger.

Nothing here mutates coins — writes go through :mod:`app.services.economy`.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.economy import CoinTransaction
from app.services import pagination


async def ledger_page(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    cursor: str | None = None,
    limit: int = 20,
) -> tuple[list[CoinTransaction], str | None, bool]:
    """One page of ledger entries, newest first.

    Returns ``(entries, next_cursor, has_more)``.
    """
    query = select(CoinTransaction).where(CoinTransaction.user_id == user_id)
    return await pagination.fetch_page(
        db, query, CoinTransaction, cursor=cursor, limit=limit
    )
