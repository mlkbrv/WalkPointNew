# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Build tools are needed to compile asyncpg and argon2 wheels, then dropped from
# the final image — they are a large attack surface to keep around in production.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev curl \
 && rm -rf /var/lib/apt/lists/*

# Dependencies are installed from pyproject alone so this layer is cached until
# the dependency list itself changes, not on every source edit.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

RUN apt-get purge -y --auto-remove build-essential libpq-dev

COPY alembic.ini start.sh ./
COPY alembic ./alembic
COPY app ./app

RUN chmod +x /app/start.sh

# The app runs unprivileged; only the media directory needs to be writable.
RUN useradd --create-home --uid 10001 stride \
 && mkdir -p /app/media \
 && chown -R stride:stride /app/media

USER stride

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-8000}/health" || exit 1

# gunicorn supervises the workers and restarts one that dies; uvicorn alone does
# not. start.sh applies migrations first and binds whatever $PORT the host gives
# it, which is what managed platforms require.
CMD ["/app/start.sh"]
