---
name: stride-backend-fastapi
description: Building the STRIDE server in backend/ on FastAPI + PostgreSQL. Use when writing or changing an endpoint, router, Pydantic schema, SQLAlchemy model, Alembic migration, auth/role dependency, APScheduler job, or anything touching the coin ledger, step sync, anti-fraud flags, moderation, coupon purchase, or redemption. Trigger on "бэкенд", "эндпоинт", "миграция", "модель БД", FastAPI, SQLAlchemy, Alembic, Postgres, APScheduler.
---

# STRIDE backend — FastAPI + Postgres

Lives in `backend/`. Everything is async: `async def` endpoints, async SQLAlchemy, no blocking
call inside a request. `docs/BACKEND_API.md` is the shape contract (paths, error envelope,
pagination); §21 is the endpoint index, §19 the delivery phases. That doc suggests Node —
**the runtime is FastAPI**; everything else in it still applies.

## Layout

`app/core` settings/security/deps/errors · `app/db` engine+session+base · `app/models` ·
`app/schemas` · `app/repositories` · `app/services` (all business rules) ·
`app/api/v1/routers` (HTTP only) · `app/workers` (APScheduler) · `app/storage` ·
`app/integrations` (SMS, FCM) · `alembic/` · `tests/`.

Routers parse and delegate. Any rule that can be violated lives in a service so it is testable
without a client, and raises a typed error from `app/core/errors.py`.

## Errors

Never raise a bare `HTTPException` with a custom body. Raise an `AppError` subclass; the handlers
in `app/main.py` render every failure as `{"error": {"code", "message"}}`.

400 validation · 401 auth · 403 role/privacy · 404 missing · 409 conflict ·
**422 business rule** (not FastAPI's default meaning — validation is remapped to 400) · 429 rate limit.

New domain rule → add a subclass in `errors.py`, don't invent a code inline.

## Auth

`Authorization: Bearer`. Access tokens are stateless and short; refresh tokens are stored hashed
in `refresh_tokens` and **rotate on every use** (the presented one is revoked). Passwords: argon2
via `app/core/security.py`. Roles `user | partner | superadmin` in the `role` claim, enforced with
`require_role(...)` / `require_superadmin` / `CurrentPartner` from `app/core/deps.py`.

Consumers sign in by email+password **or** phone+SMS; the SMS provider sits behind
`app/integrations/sms.py` (`MockSMSBackend` by default — never call a provider SDK directly).

## Economy invariants — the part that must never regress

- **`coin_transactions` is append-only.** Balance = `SUM(amount)`. There is no mutable balance
  column and no `UPDATE` on a ledger row, ever. Corrections are new entries.
- **Reward formula** (from `economy_settings`, never hardcoded):
  `steps < minimum_steps_threshold → 0`, otherwise
  `reward_at_threshold + ((steps - threshold) // 1000) * reward_per_extra_thousand_steps`.
  Defaults 5000 / 50 / 10.
- **Sync is idempotent.** `daily_steps` is unique per `(user_id, date)`. Lock the row
  (`with_for_update`), compute the reward for the old and the new step count, and credit only the
  **delta**. Steps never decrease; a lower report is ignored.
- **Anti-fraud flags, never auto-blocks.** Above `suspicious_steps_per_day`, or an implausible
  jump versus the previous report, sets `is_suspicious` + a `FlaggedEvent` and withholds the
  coins. A superadmin approves or rejects; only approval writes the ledger entry.
  `hard_cap_steps_per_day` caps what can ever accrue. Reject syncs older than `max_sync_age_days`.
- **Purchase is one transaction**: lock the coupon row, check status/window/stock/balance, insert
  the negative `coupon_spend` entry, create the `UserCoupon`. `qr_token` is server-generated.
- **Moderation gate**: only `approved` coupons and stories reach consumer endpoints — refuse with
  `NOT_APPROVED` / `NOT_PUBLISHED` rather than silently filtering in some places and not others.
- Stories expire at `published_at + story_lifetime_hours`; filter on read *and* expire on a job.

## Porting source

`../StepUpBackend` (Django, same product) holds proven versions of this logic — port from it
instead of redesigning: `apps/gamification/services.py` (`compute_steps_reward`, `sync_daily_steps`),
`apps/coupons/services.py` (`purchase_coupon`, `redeem_coupon`), `apps/users/services.py` +
`apps/users/sms/backends.py`, and the model fields under `apps/*/models.py`. Two things it does
**not** have and we must write ourselves: anti-fraud detection (only the `FlaggedEvent` model
exists there) and any scheduler.

Its balance lives in a mutable `user.coins` column — **do not port that**; our balance is the ledger sum.

## Media

Uploads are staff-only and verified: the declared content type must be on the
allow-list **and** the bytes must start with that type's magic number. A declared
type is attacker controlled, and an HTML file served from the media path is stored
XSS. Storage keys are server-generated — an uploaded filename never decides where
bytes land.

Bytes go through `app/storage`, addressed by a relative key. Nothing above that
layer knows whether they are on disk or in S3.

## Scheduled jobs

APScheduler jobs run in **one process only** — `python -m app.worker`, deployed as
a single replica with `SCHEDULER_ENABLED=true`. The API runs with it disabled,
because gunicorn forks several workers and each would otherwise start its own
scheduler and run every job N times.

## Migrations

Every model change ships an Alembic revision in the same commit. Autogenerate, then read the diff
(it misses index and enum changes). Never edit an applied revision — add a new one.

## Endpoint checklist

1. Matches `docs/BACKEND_API.md`. 2. Pydantic schemas both ways, no bare dicts. 3. Auth/role
dependency. 4. Cursor pagination (`cursor` + `limit`, default 20, max 50) on lists. 5. ISO-8601 UTC.
6. Rules in a service raising typed errors. 7. Alembic revision if models changed. 8. Tests: happy
path plus the business-rule failure. 9. Tagged so it lands in the right Swagger group.

Client side of the same contract: **stride-api-client**.
