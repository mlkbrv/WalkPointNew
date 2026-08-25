"""Keyset pagination shared by every newest-first listing.

Keyset rather than offset: rows are inserted at the head of these lists constantly
(a ledger entry, a notification), and with an offset that makes a row appear twice
or vanish while the user scrolls.

The sort key is ``(created_at, id)``. The id tie-breaker is not decoration —
entries written in one transaction share a timestamp, and on time alone a page
boundary would repeat or drop them.
"""

from __future__ import annotations

import base64
import binascii
import uuid
from datetime import datetime
from typing import Any, TypeVar

from sqlalchemy import Select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError

T = TypeVar("T")


def encode_cursor(created_at: datetime, row_id: uuid.UUID) -> str:
    """Opaque cursor holding the sort key of the last row on a page.

    The timestamp is round-tripped exactly as the database returned it, so the
    bound comparison value matches the stored one. Normalising it here would
    reintroduce the format mismatch this is designed to avoid.
    """
    raw = f"{created_at.isoformat()}|{row_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        timestamp, row_id = raw.split("|", 1)
        return datetime.fromisoformat(timestamp), uuid.UUID(row_id)
    except (ValueError, binascii.Error) as exc:
        raise ValidationError("Cursor is malformed.", code="BAD_CURSOR") from exc


def apply_cursor(query: Select, model: Any, cursor: str | None) -> Select:
    """Narrow ``query`` to rows strictly older than the cursor position.

    Written out rather than as a row-value comparison so each bound parameter is
    typed by its own column — a UUID compared inside ``tuple_()`` skips the
    column's bind processing and silently stops matching.
    """
    if not cursor:
        return query

    cursor_time, cursor_id = decode_cursor(cursor)
    return query.where(
        or_(
            model.created_at < cursor_time,
            and_(model.created_at == cursor_time, model.id < cursor_id),
        )
    )


async def fetch_page(
    db: AsyncSession, query: Select, model: Any, *, cursor: str | None, limit: int
) -> tuple[list[Any], str | None, bool]:
    """Run a newest-first keyset page. Returns ``(rows, next_cursor, has_more)``."""
    query = apply_cursor(query, model, cursor)
    query = query.order_by(model.created_at.desc(), model.id.desc())

    # One extra row tells us whether another page exists, without a count query.
    fetched = list((await db.scalars(query.limit(limit + 1))).all())
    has_more = len(fetched) > limit
    rows = fetched[:limit]

    next_cursor = None
    if has_more and rows:
        next_cursor = encode_cursor(rows[-1].created_at, rows[-1].id)

    return rows, next_cursor, has_more
