"""Application settings, loaded from environment / .env (see .env.example)."""

from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalise_database_url(url: str) -> str:
    """Make a hosted-Postgres connection string usable by SQLAlchemy + asyncpg.

    Managed providers (Neon, Supabase, Railway, Render) hand out a URL shaped for
    libpq::

        postgresql://user:pass@host/db?sslmode=require

    Two things are wrong with that here, and both fail at connect time rather
    than at import, which makes them unpleasant to debug on a fresh deploy:

    * the driver is unspecified, so SQLAlchemy reaches for psycopg2, which is
      synchronous and not installed;
    * SQLAlchemy hands unrecognised query parameters to ``asyncpg.connect`` as
      keyword arguments, and asyncpg wants ``ssl``, not ``sslmode``.

    So: force the asyncpg driver and rename ``sslmode`` to ``ssl``, **keeping its
    value**. asyncpg parses a string ``ssl`` as an sslmode, so it only accepts
    ``disable``/``allow``/``prefer``/``require``/``verify-ca``/``verify-full`` —
    passing ``ssl=true`` fails with a message that names ``sslmode``, which is a
    confusing way to be told the value was wrong.

    Anything already addressed to ``+asyncpg`` is left alone.
    """
    if not url:
        return url

    scheme, separator, remainder = url.partition("://")
    if not separator:
        return url

    # `postgres://` is the legacy spelling several providers still emit.
    if scheme in {"postgres", "postgresql"}:
        url = f"postgresql+asyncpg://{remainder}"
    elif not scheme.startswith("postgresql+"):
        return url

    base, question, query = url.partition("?")
    if not question:
        return url

    # The only values asyncpg will accept for a string `ssl`.
    ssl_modes = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}

    kept: list[str] = []
    ssl_mode: str | None = None

    for parameter in query.split("&"):
        name, _, value = parameter.partition("=")
        if name in {"sslmode", "ssl"}:
            # Booleans are what a human writes and what asyncpg rejects.
            if value in {"true", "1", "yes"}:
                ssl_mode = "require"
            elif value in {"false", "0", "no"}:
                ssl_mode = "disable"
            elif value in ssl_modes:
                ssl_mode = value
            else:
                ssl_mode = "require"
            continue
        if name in {"channel_binding", "options", "target_session_attrs"}:
            # libpq-only knobs asyncpg does not accept.
            continue
        if parameter:
            kept.append(parameter)

    # `disable` is the default anyway, so it is dropped rather than passed on.
    if ssl_mode and ssl_mode != "disable":
        kept.append(f"ssl={ssl_mode}")

    return f"{base}?{'&'.join(kept)}" if kept else base


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "STRIDE API"
    environment: str = "local"
    debug: bool = True
    api_v1_prefix: str = "/v1"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "stride"
    postgres_user: str = "stride"
    postgres_password: str = "change-me"
    database_url_override: str | None = None

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 30

    # SMS
    sms_backend: str = "mock"
    sms_code_ttl_minutes: int = 5
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # Push
    fcm_enabled: bool = False
    firebase_credentials_file: str = ""

    # Storage
    storage_backend: str = "local"
    media_root: str = "./media"
    media_url_prefix: str = "/media"

    # First-boot bootstrap. Managed free tiers have no shell, so the first staff
    # account has to be creatable from the environment. Both must be set for
    # anything to happen, and an existing account is never modified.
    bootstrap_superadmin_email: str = ""
    bootstrap_superadmin_password: str = ""

    # Shared secret for the HTTP job trigger. Empty disables the endpoint, which
    # is the right default: it must be opt-in, not something a deploy exposes.
    cron_secret: str = ""

    # Scheduler
    scheduler_enabled: bool = True
    daily_rollup_hour: int = 23
    daily_rollup_minute: int = 59
    server_timezone: str = "Asia/Baku"

    # Anti-fraud guard rails (defaults; the tunable economy lives in the DB settings table)
    suspicious_steps_per_day: int = Field(default=35_000)
    hard_cap_steps_per_day: int = Field(default=50_000)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return normalise_database_url(self.database_url_override)
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
