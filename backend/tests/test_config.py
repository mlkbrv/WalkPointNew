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
            "postgresql+asyncpg://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/stride?ssl=require",
        ),
        # Neon also appends channel_binding, which asyncpg does not accept.
        (
            "postgresql://u:p@host/db?sslmode=require&channel_binding=require",
            "postgresql+asyncpg://u:p@host/db?ssl=require",
        ),
        # The legacy scheme several providers still emit.
        (
            "postgres://u:p@host:5432/db?sslmode=require",
            "postgresql+asyncpg://u:p@host:5432/db?ssl=require",
        ),
        # No query string at all.
        ("postgresql://u:p@host:5432/db", "postgresql+asyncpg://u:p@host:5432/db"),
        # A stricter mode is preserved rather than flattened to "on".
        (
            "postgresql://u:p@host/db?sslmode=verify-full",
            "postgresql+asyncpg://u:p@host/db?ssl=verify-full",
        ),
        # Explicitly disabled TLS stays disabled.
        ("postgresql://u:p@host/db?sslmode=disable", "postgresql+asyncpg://u:p@host/db"),
        # A boolean is what a human writes; asyncpg rejects it, so it is mapped.
        ("postgresql://u:p@host/db?sslmode=true", "postgresql+asyncpg://u:p@host/db?ssl=require"),
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
    assert "ssl=require" in result
    assert "sslmode" not in result


def test_every_emitted_ssl_value_is_one_asyncpg_accepts():
    """The bug this guards: `ssl=true` is rejected, and asyncpg blames `sslmode`."""
    from asyncpg import connect_utils

    for mode in ["require", "verify-full", "prefer", "true", "1"]:
        result = normalise_database_url(f"postgresql://u:p@h/db?sslmode={mode}")
        _, _, query = result.partition("?")
        if not query:
            continue
        value = query.split("ssl=", 1)[1].split("&")[0]
        connect_utils.SSLMode.parse(value)  # raises if asyncpg would refuse it


def test_the_override_is_normalised_by_settings():
    from app.core.config import Settings

    settings = Settings(
        database_url_override="postgresql://u:p@host/db?sslmode=require",
    )
    assert settings.database_url == "postgresql+asyncpg://u:p@host/db?ssl=require"
