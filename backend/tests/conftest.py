"""Test fixtures: an in-memory SQLite database and an HTTP client bound to it.

Models use dialect-agnostic column types, so the suite runs without Postgres.
Anything relying on Postgres-specific behaviour belongs in an integration test.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault("JWT_SECRET", "test-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("SMS_BACKEND", "mock")
os.environ.setdefault("SCHEDULER_ENABLED", "false")

from argon2 import PasswordHasher  # noqa: E402

from app.core import security  # noqa: E402
from app.core.deps import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

# Argon2 is deliberately slow, which is right in production and pointless here:
# the suite signs in on almost every test and the cost dominates its runtime.
# Only the work factor changes — the same hasher and the same code paths run.
security._hasher = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)


@pytest.fixture
async def engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session_factory(engine):
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def db(session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        yield session


@pytest.fixture
async def client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    async def _get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
