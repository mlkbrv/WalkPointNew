"""Async engine and session factory."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import normalise_database_url, settings

# Normalised again here rather than trusting the caller: a hosted-Postgres URL
# that slips through unconverted fails at connect time, on a deployed host,
# with an error that points at asyncpg rather than at the setting.
engine = create_async_engine(
    normalise_database_url(settings.database_url),
    echo=settings.debug and settings.environment == "local",
    pool_pre_ping=True,
    future=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one session per request, rolled back on failure."""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
