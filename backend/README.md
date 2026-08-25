# STRIDE backend (FastAPI)

Step-to-Earn API: steps → coins → partner coupons.

## Run locally

```bash
cp .env.example .env
docker compose up -d postgres redis      # from the repository root
pip install -e ".[dev]"
alembic upgrade head
python -m app.cli seed
python -m app.cli create-superadmin admin@example.com a-strong-password
uvicorn app.main:app --reload
```

Swagger: http://localhost:8000/docs

## Layout

| Path | Role |
|---|---|
| `app/core` | settings, security, dependencies, typed errors |
| `app/db` | async engine, session, declarative base |
| `app/models` | SQLAlchemy 2.0 models |
| `app/schemas` | Pydantic v2 request/response schemas |
| `app/services` | business logic — the only place rules live |
| `app/api/v1/routers` | HTTP layer, one router per domain |
| `app/workers` | APScheduler jobs (nightly coin roll-up, story expiry) |
| `app/storage` | media storage behind an interface (local disk now, S3 later) |
| `app/integrations` | SMS, FCM and other external providers |

## The coin economy

Steps become coins in two places, and they agree by construction:

* **On sync** — `POST /v1/steps/sync` credits the difference between what the day
  has earned and what it has already been paid. Re-posting the same total credits
  nothing, so the client can sync as often as it likes.
* **At 23:59** — the APScheduler job settles yesterday for everyone, pays anything
  a sync left outstanding, and sends the "you earned N" / "you were N short"
  notification. Idempotent: a day is only rolled up once.

The reward curve lives in `economy_settings` and is editable from the admin panel:

```
steps < minimum_steps_threshold        -> 0 coins        (default 5 000)
steps >= threshold                     -> reward_at_threshold                 (default 50)
                                        + ((steps - threshold) // 1000)
                                        * reward_per_extra_thousand_steps      (default 10)
capped at hard_cap_steps_per_day                                               (default 50 000)
```

## Anti-fraud

Health Connect data comes off the user's own device, so it is forgeable. The
screening in `app/services/antifraud.py` flags two signals — an implausible daily
total, and a rate of increase above `max_steps_per_hour` — and then **withholds
the coins without blocking anyone**. A superadmin releases the day
(`POST /v1/admin/steps/flagged/{id}/approve`) or discards it. A rejected day keeps
its `is_suspicious` mark so a later sync cannot quietly pay it out.

## Content moderation

Coupons and stories share one lifecycle, written once in `app/services/moderation.py`:

```
draft -> pending -> approved | rejected
  ^                    |
  +--------------------+   (a rejection is editable again, with the reason attached)
```

* A partner submits and withdraws; only a superadmin approves or rejects, and a
  rejection must carry a reason the partner reads verbatim.
* Approved content is frozen — editing requires withdrawing it first, so terms
  cannot be swapped after the review that cleared them.
* The business itself is approved separately: an unapproved or suspended merchant
  cannot even queue content for review, and **suspending a business pulls its live
  coupons and stories back to draft**.
* A story's 24h clock starts at *approval*, not creation, so time in the queue does
  not eat into its run. Expiry is filtered in the feed query and swept by a job.

## Purchase and redemption

`POST /v1/coupons/{id}/purchase` is one transaction taking two row locks, always in
the same order — **the buyer's user row first, then the coupon row**. The user row
is the wallet mutex: a balance is a `SUM` over the ledger, so without it two
concurrent purchases could each read the same balance and both succeed. Consistent
ordering is what keeps two buyers racing for the last coupon from deadlocking.
Inside that window it checks the moderation status, the sale window, stock, and the
balance, then appends the negative ledger entry and issues the voucher.

`POST /v1/redemptions/scan` locks the voucher, so a code shown at two tills at once
burns exactly once. A code belonging to another business is refused with the same
message as an unknown code — a merchant has no business learning that a code is
real but a competitor's.

Voucher expiry is reported on read (the wallet never shows a code that would be
refused) and swept hourly so the stored state stays honest for reporting.

## Notifications and push

The in-app `notifications` row is the **durable record**; push is the nudge on top
of it. Every event writes the row first and attempts delivery second, so a user who
was offline still finds the message in their inbox, and a dead device or an
unreachable FCM never fails the request that triggered it.

Push is always dispatched **after the caller commits** — a delivery attempt must
never sit inside a transaction holding row locks.

| Event | Inbox row | Push |
|---|---|---|
| Nightly roll-up (earned / fell short) | yes | one multicast per distinct message |
| Coins released after fraud review | yes | yes |
| Coupon bought, coupon redeemed | yes | yes |
| Business / coupon / story reviewed | yes, to the partner | yes |
| New coupon approved | no | yes, to all consumers |
| Admin broadcast | yes | yes |

The new-coupon announcement is push-only on purpose: an inbox row per user for
every approved coupon would bury the inbox, which is where people look for things
that concern them personally.

### Plugging in Firebase

1. Put the service-account JSON somewhere the container can read it.
2. Set `FIREBASE_CREDENTIALS_FILE` to that path and `FCM_ENABLED=true`.

Until then `LoggingPushBackend` runs, so every call site is exercised in
development without a key. Tokens FCM reports as permanently gone
(`UnregisteredError`, `SenderIdMismatchError`) are pruned automatically; transient
failures never cost a user their registration.

## Support chat

The app shows a **single chat thread**, not a ticket queue, so the consumer API
never asks the user to open or pick a ticket — posting a message finds their open
ticket or starts one. Tickets exist underneath because staff need something to
close, count, and page through.

Closing is a staff-side idea of "handled". A user who writes again after a close
gets a **new** ticket rather than reopening the old one, so a closed thread stays
an accurate record of what was resolved and when.

Reading is opening: fetching a thread stamps the other side's messages as read.
The user's badge counts unread staff replies; the staff queue counts open tickets
whose newest message came from the user, which is the actual work list.

A staff reply pushes a **truncated** preview — a lock-screen banner is the wrong
place for a full support answer, and it may carry account details. The full text
lives in the thread.

The FAQ is served from `GET /v1/support/faq` and managed by staff, replacing the
list the mobile Help screen currently hardcodes. `python -m app.cli seed` installs
the default entries.

## Media uploads

`POST /v1/media/uploads` is staff-only — partners attach images to their own
coupons and stories, consumers have nothing to upload. Three checks run in
increasing cost order: the declared type is on the allow-list, the body is within
the size limit, and **the bytes actually start with that type's magic number**.
The third is the one that matters: a declared content type is attacker
controlled, and an HTML file served from the media path would be stored XSS.

Storage keys are server-generated (`coupon/<uuid>.jpg`) — an uploaded filename
never decides where bytes land. The response `key` is what goes on a coupon's
`image_path` or a story's `media_path`.

## Rules that must not be broken

1. The coin ledger (`coin_transactions`) is **append-only**; a balance is `SUM(amount)`.
2. `daily_steps` is unique per `(user_id, date)` — a re-sync awards only the reward *delta*.
3. Flagged (`is_suspicious`) step days never accrue coins automatically; a superadmin releases them.
4. Only `approved` coupons and stories are visible to the mobile app.
5. Redemption codes (`user_coupons.qr_token`) are generated server-side only.
6. A partner can only ever read and write their own business's content.
7. Push delivery is best-effort and must never fail or roll back the caller.
8. Uploaded bytes are verified against their declared type, and stored under a
   server-generated key.

The API contract lives in `../docs/BACKEND_API.md`.
