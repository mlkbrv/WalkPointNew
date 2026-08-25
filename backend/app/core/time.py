"""UTC helpers.

Postgres returns timezone-aware datetimes for ``TIMESTAMPTZ`` columns, but SQLite
(used by the test suite) hands back naive ones. Comparing the two raises, so every
comparison against a stored timestamp goes through :func:`as_aware`.
"""

from __future__ import annotations

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_aware(value: datetime | None) -> datetime | None:
    """Treat a naive datetime as UTC; leave an aware one untouched."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)
