"""Connection-string normalisation.

These are the shapes managed Postgres providers actually hand out. Getting one
wrong fails at connect time on a fresh deploy, which is the worst moment to be
debugging a URL.
"""

from __future__ import annotations

import pytest

from app.core.config import normalise_database_url


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        # Neon: the exact string its dashboard copies.
        (
            "postgresql://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/stride?sslmode=require",
            "postgresql+asyncpg://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/stride?ssl=true",
        ),
        # Neon also appends channel_binding, which asyncpg does not accept.
        (
            "postgresql://u:p@host/db?sslmode=require&channel_binding=require",
            "postgresql+asyncpg://u:p@host/db?ssl=true",
        ),
        # The legacy scheme several providers still emit.
        (
            "postgres://u:p@host:5432/db?sslmode=require",
            "postgresql+asyncpg://u:p@host:5432/db?ssl=true",
        ),
        # No query string at all.
        ("postgresql://u:p@host:5432/db", "postgresql+asyncpg://u:p@host:5432/db"),
        # Explicitly disabled TLS stays disabled.
        ("postgresql://u:p@host/db?sslmode=disable", "postgresql+asyncpg://u:p@host/db"),
        # Already correct: left exactly as it is.
        (
            "postgresql+asyncpg://u:p@host:5432/db",
            "postgresql+asyncpg://u:p@host:5432/db",
        ),
        # Not Postgres: not our business.
        ("sqlite+aiosqlite:///./x.db", "sqlite+aiosqlite:///./x.db"),
        ("", ""),
    ],
)
def test_normalise_database_url(given, expected):
    assert normalise_database_url(given) == expected


def test_unrelated_query_parameters_survive():
    result = normalise_database_url(
        "postgresql://u:p@host/db?sslmode=require&application_name=stride"
    )
    assert "application_name=stride" in result
    assert "ssl=true" in result
    assert "sslmode" not in result


def test_the_override_is_normalised_by_settings():
    from app.core.config import Settings

    settings = Settings(
        database_url_override="postgresql://u:p@host/db?sslmode=require",
    )
    assert settings.database_url == "postgresql+asyncpg://u:p@host/db?ssl=true"
