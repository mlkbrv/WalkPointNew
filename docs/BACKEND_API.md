# STRIDE Backend API

0-to-hero spec for replacing all local/mock state in the Expo consumer app. Coupons and stories are created on a **separate business frontend**. They go live only after **admin approval** and merchant publish (with token cost). **Buster stores** are paid featured listings (Stripe).

This document is the integration bible. It does not implement the server.

---

## 1. Overview

### 1.1 Clients

| Client | Who | What it does |
|---|---|---|
| Consumer Expo app (this repo) | Walkers | Auth, steps, store, buy coupons, wallet, stories, workouts, leaderboard, inbox |
| Business web (separate) | Merchants | Store profile, draft/submit coupons + stories, set cost after approval, buy Buster boosts, scan redemptions |
| Admin | STRIDE staff | Approve/reject content, moderate stores, complimentary boosts, ledger adjustments |

In-app `CreateCouponScreen` / `MerchantManagerScreen` become read-only or deep-link to business web. Consumer app never creates catalog content.

### 1.2 Replace these local keys

| Key | Today | Server |
|---|---|---|
| `@stride/auth_user` | Fake session | JWT + `/v1/me` |
| `@stride/user_prefs` | Local toggles | `PATCH /v1/me/prefs` |
| `@stride/app_state_v3` | Stats, coupons, inbox, workouts, devices | Ledger + resource APIs |
| `@stride/health_mock_v2` | Dev mock only | Stay local (dev). Production uses `/v1/health/sync` |
| `@stride/seen_stories_v1` | Seen IDs | `POST /v1/stories/:id/seen` |
| `@stride/health_connect_gate_v1` | Android gate passed | Client-only until real HC SDK; then still local + `POST /devices/health_connect/connect` |

Ignore dead `src/hooks/useStrideState.ts`. Help FAQ can stay static until a later CMS.

### 1.2.1 Android Health Connect wall (mandatory)

On **Android**, after login the consumer app shows a **full-screen blocking wall** (`HealthConnectWall`) until Health Connect is enabled. The user cannot dismiss it or use the rest of the app.

**Client rules**

| Rule | Detail |
|---|---|
| Who | `Platform.OS === "android"` and user is authenticated |
| Block when | `healthConnectReady === false` and not `__DEV__` mock mode |
| Persist | `@stride/health_connect_gate_v1` → `{ ready: true }` only after permissions granted |
| Re-check | On cold start, if gate was true but `Pedometer.getPermissionsAsync()` is not `granted`, clear gate and show wall again |
| Primary CTA | Request activity / Steps permission, then start pedometer tracking |
| Secondary | Deep-link / open Health Connect app or Play Store listing `com.google.android.apps.healthdata` |
| Mock bypass | **`__DEV__` only** — production builds have no mock escape |
| iOS | No wall; Motion & Fitness via normal Health Setup |

**Backend contract**

1. Wall success does **not** replace step truth: app must still call `POST /v1/health/sync` with `source: "health_connect"` (or `pedometer` until HC SDK is wired).
2. After wall pass, client should call `POST /v1/devices/health_connect/connect`.
3. If later `GET /v1/me` or sync returns that device is disconnected / permission revoked, client clears the local gate and shows the wall again.
4. Optional server flag (future): `GET /v1/me` → `requirements.android_health_connect_required: true` so the wall can be forced remotely.

**Integration map**

| UI | Behavior |
|---|---|
| `HealthConnectWall` | Blocks Main stack on Android until ready |
| `HealthSetupScreen` | Same instructions; wall is the hard gate |
| Home health banner | Soft reminder only on iOS / after gate passed |

**Note:** Today the app still reads live steps via `expo-sensors` Pedometer after the wall. The wall enforces the **product policy** (user must install/allow Health Connect). A future native Health Connect SDK should replace Pedometer for `getStepCountAsync` / historical reads while keeping this wall.

### 1.3 Recommended stack

Node (NestJS or Fastify), Postgres, Redis, S3-compatible media, Stripe (Buster only), FCM/APNs.

Do not trust client `totalTokens`. Balance = sum of ledger.

### 1.4 Base URL and versioning

```
https://api.stride.app/v1
```

All dates ISO-8601 UTC. Pagination: `?cursor=` + `limit` (default 20, max 50).

### 1.5 Auth header

```
Authorization: Bearer <access_token>
```

Public (no auth): store catalog, published coupon list/detail, published stories rail (seen requires auth).

### 1.6 Roles

`consumer` | `merchant` | `admin`

A user can have one primary role. Merchant accounts own exactly one `store`. Admin is staff-only (invite).

### 1.7 Error shape

```json
{
  "error": {
    "code": "INSUFFICIENT_TOKENS",
    "message": "Not enough tokens to purchase this coupon."
  }
}
```

| HTTP | When |
|---|---|
| 400 | Validation |
| 401 | Missing/invalid token |
| 403 | Wrong role or privacy |
| 404 | Not found |
| 409 | Conflict (already used, already boosted) |
| 422 | Business rule (not approved, expired, cap) |
| 429 | Rate limit (step sync, purchase) |

Common codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_TOKENS`, `NOT_APPROVED`, `NOT_PUBLISHED`, `EXPIRED`, `ALREADY_USED`, `STEP_CAP_EXCEEDED`, `BOOST_ACTIVE`.

### 1.8 IDs

UUIDv7 (or ULID). Client never invents redemption codes.

---

## 2. Content lifecycle

Applies to **coupons** and **stories**.

```
draft → pending_review → approved → published → expired
                      ↘ rejected
published → unpublished (merchant)
approved → pending_review (cost/content change after publish)
```

Rules:

1. Merchant creates/edits **draft** (images, copy, frames, category).
2. Submit → `pending_review`. Hidden from consumer app.
3. Admin approve or reject with reason.
4. After **approved**, merchant sets **token cost** (coupons) and publishes.
5. Consumer APIs return only `status=published` and not expired.
6. Changing cost or creative after publish → back to `pending_review` (or admin override).
7. Stories expire 24h after `published_at` unless admin sets another TTL.

---

## 3. Token economy

Current app formula (must move server-side):

```
tokens_from_steps = floor(steps / 1000) * 10
balance = tokens_from_steps + bonus - spent
```

Server model: **append-only ledger**. Displayed balance = `SUM(amount)`.

| type | amount | Source |
|---|---|---|
| `steps_accrual` | +delta | Daily step sync (recomputed vs previous snapshot for that date) |
| `workout_bonus` | +N | Workout finish (`max(180, floor(distance_km * 65))`) |
| `coupon_spend` | -cost | Purchase |
| `admin_adjust` | +/- | Staff |

`POST /v1/health/sync` is the only way steps become tokens. Cap **50,000 steps/day**. Reject syncs older than 3 days except admin. Idempotent per `(user_id, date, source, steps)`.

`POST /v1/coupons/:id/purchase` is one DB transaction: lock wallet, check balance, insert `coupon_spend`, issue voucher.

---

## 4. Auth

### `POST /v1/auth/register`

**Auth:** none  
**Clients:** consumer, business

```json
{
  "name": "Felix K.",
  "email": "felix@example.com",
  "password": "secret12",
  "role": "consumer",
  "business_name": null
}
```

Merchant must send `business_name`. Creates user + empty prefs. Merchant also gets a `store` in `draft`.

```json
{
  "user": {
    "id": "usr_01",
    "name": "Felix K.",
    "email": "felix@example.com",
    "avatar_url": null,
    "role": "consumer",
    "member_since": "2026-08-13",
    "business_name": null,
    "store_id": null
  },
  "tokens": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 900
  }
}
```

### `POST /v1/auth/login`

```json
{ "email": "felix@example.com", "password": "secret12" }
```

Same response as register. 401 if invalid.

### `POST /v1/auth/refresh`

```json
{ "refresh_token": "eyJ..." }
```

```json
{ "access_token": "eyJ...", "refresh_token": "eyJ...", "expires_in": 900 }
```

### `POST /v1/auth/logout`

**Auth:** required  
Body: `{ "refresh_token": "eyJ..." }`  
Response: `{ "ok": true }`

### `POST /v1/auth/forgot-password`

```json
{ "email": "felix@example.com" }
```

Always `{ "ok": true, "message": "If the account exists, a reset link was sent." }`

### `POST /v1/auth/reset-password`

```json
{ "token": "rst_...", "password": "newsecret12" }
```

`{ "ok": true }`

### `GET /v1/me`

**Auth:** required

```json
{
  "user": {
    "id": "usr_01",
    "name": "Felix K.",
    "email": "felix@example.com",
    "avatar_url": "https://cdn.stride.app/u/usr_01.jpg",
    "role": "consumer",
    "member_since": "2026-01-01",
    "business_name": null,
    "store_id": null
  },
  "profile": {
    "steps_goal": 16000,
    "weight_kg": 75,
    "height_cm": 180,
    "pedometer_active": true,
    "streak_days": 4
  },
  "prefs": {
    "notifications_enabled": true,
    "privacy_visible": true,
    "email_alerts": true,
    "marketing_push": false
  },
  "wallet": {
    "balance": 120,
    "bonus_tokens": 180,
    "spent_tokens": 50,
    "steps_tokens": 0
  }
}
```

`switchRole` from the app is **not** an API. Role is fixed at register (admin can change).

### `PATCH /v1/me`

```json
{
  "name": "Felix K.",
  "avatar_media_id": "med_01"
}
```

Returns updated `user`.

### `PATCH /v1/me/profile`

```json
{
  "steps_goal": 16000,
  "weight_kg": 75,
  "height_cm": 180,
  "pedometer_active": true
}
```

### `PATCH /v1/me/prefs`

```json
{
  "notifications_enabled": true,
  "privacy_visible": true,
  "email_alerts": true,
  "marketing_push": false
}
```

`privacy_visible=false` hides the user from `GET /v1/leaderboard`.

---

## 5. Health / steps

Device pedometer / Health Connect stays on-device. Backend stores **daily snapshots** and accrues tokens.

### `POST /v1/health/sync`

**Auth:** consumer

```json
{
  "date": "2026-08-13",
  "steps": 8420,
  "source": "pedometer",
  "timezone": "Asia/Dubai"
}
```

`source`: `pedometer` | `health_connect` | `apple_health` | `fitbit` | `mock`

```json
{
  "date": "2026-08-13",
  "steps": 8420,
  "capped": false,
  "tokens_accrued": 80,
  "wallet": { "balance": 200, "steps_tokens": 80, "bonus_tokens": 180, "spent_tokens": 60 }
}
```

422 `STEP_CAP_EXCEEDED` if raw steps > 50000 (store 50000, `capped: true`).  
If new steps < previous for that date, do not claw back already-spent tokens; only reduce future accrual to the new floor.

### `GET /v1/health/today`

```json
{
  "date": "2026-08-13",
  "steps": 8420,
  "goal": 16000,
  "distance_km": 6.32,
  "calories_kcal": 336,
  "duration_mins": 37,
  "streak_days": 4
}
```

Derived: `km = steps * 0.00075`, `kcal = floor(steps * 0.04)`, `mins = floor(steps * 0.0045)`.

### `GET /v1/health/weekly?end=2026-08-13`

```json
{
  "days": [
    { "date": "2026-08-07", "day": "F", "steps": 6100, "is_today": false },
    { "date": "2026-08-13", "day": "T", "steps": 8420, "is_today": true }
  ]
}
```

### `GET /v1/health/series?range=day|month&end=2026-08-13`

For Performance reports (replace hardcoded chart slices).

```json
{
  "range": "day",
  "points": [
    { "label": "6a", "steps": 400 },
    { "label": "9a", "steps": 1200 }
  ]
}
```

---

## 6. Wallet / ledger

### `GET /v1/wallet`

```json
{
  "balance": 200,
  "steps_tokens": 80,
  "bonus_tokens": 180,
  "spent_tokens": 60
}
```

### `GET /v1/wallet/ledger?cursor=&limit=20`

```json
{
  "items": [
    {
      "id": "led_01",
      "type": "coupon_spend",
      "amount": -50,
      "ref_type": "voucher",
      "ref_id": "vch_01",
      "created_at": "2026-08-13T18:01:00Z"
    }
  ],
  "next_cursor": null
}
```

### `GET /v1/wallet/vouchers?status=active|used|expired`

Maps to Wallet screen `userCoupons`.

```json
{
  "items": [
    {
      "id": "vch_01",
      "coupon_id": "cpn_01",
      "title": "Free Large Caramel Macchiato",
      "brand_id": "sto_sb",
      "brand_name": "Starbucks",
      "logo_url": "https://cdn.stride.app/s/sb.png",
      "category": "BEVERAGE REWARD",
      "image_url": "https://cdn.stride.app/c/mac.jpg",
      "steps_cost": 50,
      "redemption_code": "SBX-K7Q2M1",
      "qr_payload": "stride:v1:vch_01:SBX-K7Q2M1",
      "status": "active",
      "used": false,
      "expires_at": "2026-09-12T00:00:00Z",
      "purchased_at": "2026-08-13T18:01:00Z"
    }
  ],
  "next_cursor": null
}
```

`redemption_code` / `qr_payload` only after purchase. Rolling display can rotate `qr_payload` via `GET /v1/wallet/vouchers/:id` (same code, short-lived signature).

---

## 7. Stores

A store is the merchant’s public brand (today: `PartnerBrand`).

| Field | Notes |
|---|---|
| `status` | `draft` \| `pending_review` \| `approved` \| `published` \| `suspended` |
| `featured` | Buster boost active |
| `featured_until` | Boost end |
| `category` | Coffee, Food, Fitness, Apparel, Beverage |

Consumer list: `status=published` only. Featured first, then recency.

### `GET /v1/stores?category=&featured=&cursor=`

**Auth:** optional

```json
{
  "items": [
    {
      "id": "sto_sb",
      "name": "Starbucks",
      "logo_url": "https://cdn.stride.app/s/sb.png",
      "cover_url": "https://cdn.stride.app/s/sb-cover.jpg",
      "category": "Coffee",
      "short_desc": "Redeem your steps for premium coffee vouchers.",
      "full_desc": "Grande beverage at participating locations.",
      "min_steps_cost": 35,
      "featured": true,
      "featured_until": "2026-08-20T00:00:00Z",
      "buster": true
    }
  ],
  "next_cursor": null
}
```

`buster` is an alias of active featured (badge on Store + Home).

### `GET /v1/stores/:id`

```json
{
  "id": "sto_sb",
  "name": "Starbucks",
  "logo_url": "https://cdn.stride.app/s/sb.png",
  "cover_url": "https://cdn.stride.app/s/sb-cover.jpg",
  "category": "Coffee",
  "short_desc": "Redeem your steps for premium coffee vouchers.",
  "full_desc": "Grande beverage at participating locations.",
  "featured": true,
  "buster": true,
  "featured_until": "2026-08-20T00:00:00Z",
  "coupons": [
    {
      "id": "cpn_01",
      "title": "Free Large Caramel Macchiato",
      "category": "BEVERAGE REWARD",
      "steps_cost": 50,
      "image_url": "https://cdn.stride.app/c/mac.jpg",
      "discount_percent": 0,
      "expires_at": "2026-09-12T00:00:00Z"
    }
  ]
}
```

### Business: `GET /v1/business/store`

**Auth:** merchant — own store (any status).

### Business: `PATCH /v1/business/store`

```json
{
  "name": "Bloom Cafe",
  "category": "Coffee",
  "short_desc": "Neighborhood pour-over.",
  "full_desc": "Trade steps for a pour-over and pastry.",
  "logo_media_id": "med_02",
  "cover_media_id": "med_03"
}
```

First publish of the store itself also goes `pending_review` → admin approve → `published`.

### Business: `POST /v1/business/store/submit`

`{ "ok": true, "status": "pending_review" }`

---

## 8. Coupons

Catalog on Store is **approved + published** offers from all stores (fixes today’s gap: merchant coupons never appear in `StoreScreen`).

### 8.1 Public / consumer

#### `GET /v1/coupons?category=&store_id=&cursor=`

```json
{
  "items": [
    {
      "id": "cpn_01",
      "title": "Free Large Caramel Macchiato",
      "store_id": "sto_sb",
      "store_name": "Starbucks",
      "logo_url": "https://cdn.stride.app/s/sb.png",
      "category": "BEVERAGE REWARD",
      "filter_cat": "Coffee",
      "steps_cost": 50,
      "image_url": "https://cdn.stride.app/c/mac.jpg",
      "discount_percent": 0,
      "expires_at": "2026-09-12T00:00:00Z",
      "store_featured": true
    }
  ],
  "next_cursor": null
}
```

Sort: `store_featured` desc, then `published_at` desc.

#### `GET /v1/coupons/:id`

Full public coupon. 404 if not published.

#### `POST /v1/coupons/:id/purchase`

**Auth:** consumer

```json
{ "idempotency_key": "dev-uuid-1" }
```

```json
{
  "voucher": {
    "id": "vch_01",
    "coupon_id": "cpn_01",
    "redemption_code": "SBX-K7Q2M1",
    "qr_payload": "stride:v1:vch_01:SBX-K7Q2M1",
    "status": "active",
    "expires_at": "2026-09-12T00:00:00Z"
  },
  "wallet": { "balance": 150, "spent_tokens": 110 }
}
```

422 `INSUFFICIENT_TOKENS` | `EXPIRED` | `NOT_PUBLISHED`.  
409 if `idempotency_key` already succeeded (return original voucher).

Creates inbox notification `coupon`.

### 8.2 Business coupon CRUD

All **Auth:** merchant. Scoped to own store.

#### `GET /v1/business/coupons`

Includes drafts and rejected.

```json
{
  "items": [
    {
      "id": "cpn_09",
      "title": "20% Off Lunch Combo",
      "status": "pending_review",
      "steps_cost": null,
      "discount_percent": 20,
      "category": "FOOD",
      "image_url": "https://cdn.stride.app/c/lunch.jpg",
      "expires_at": "2026-09-12T00:00:00Z",
      "redemptions": 0,
      "views": 12,
      "rejection_reason": null,
      "created_at": "2026-08-13T10:00:00Z"
    }
  ]
}
```

Increment `views` on consumer `GET /v1/coupons/:id` and Brand store impressions.

#### `POST /v1/business/coupons`

```json
{
  "title": "20% Off Lunch Combo",
  "category": "FOOD",
  "discount_percent": 20,
  "image_media_id": "med_04",
  "expires_at": "2026-09-12T00:00:00Z"
}
```

Creates `status=draft`. `steps_cost` is **not** set until approved + publish.

```json
{ "id": "cpn_09", "status": "draft" }
```

#### `PATCH /v1/business/coupons/:id`

Allowed in `draft` or `rejected`. If `published`, PATCH of creative/cost → `pending_review`.

#### `POST /v1/business/coupons/:id/submit`

draft|rejected → `pending_review`

#### `POST /v1/business/coupons/:id/publish`

**Only if `approved`.**

```json
{ "steps_cost": 50 }
```

```json
{ "id": "cpn_09", "status": "published", "steps_cost": 50, "published_at": "2026-08-13T12:00:00Z" }
```

422 `NOT_APPROVED` if still pending/rejected.

#### `POST /v1/business/coupons/:id/unpublish`

published → `unpublished` (approved snapshot kept; republish without new review if cost unchanged).

### 8.3 Admin coupon review

**Auth:** admin

#### `GET /v1/admin/coupons?status=pending_review`

#### `POST /v1/admin/coupons/:id/approve`

```json
{ "id": "cpn_09", "status": "approved" }
```

#### `POST /v1/admin/coupons/:id/reject`

```json
{ "reason": "Image is too low quality." }
```

```json
{ "id": "cpn_09", "status": "rejected", "rejection_reason": "Image is too low quality." }
```

---

## 9. Redemptions (scan)

Consumer reveals code on SecureVerification. Merchant scans on business web or in-app scanner.

### `GET /v1/wallet/vouchers/:id`

**Auth:** owner. Returns fresh `qr_payload` (signed, TTL 60s).

### `POST /v1/redemptions/scan`

**Auth:** merchant

```json
{
  "code": "SBX-K7Q2M1",
  "qr_payload": "stride:v1:vch_01:SBX-K7Q2M1:sig"
}
```

Send `code` or `qr_payload`.

```json
{
  "ok": true,
  "voucher_id": "vch_01",
  "title": "Free Large Caramel Macchiato",
  "store_id": "sto_sb"
}
```

409 `ALREADY_USED`. 404 invalid. 403 if voucher belongs to another store.

Marks voucher `used`, increments coupon `redemptions`, writes audit row.

### `GET /v1/business/redemptions?cursor=`

Merchant audit log.

```json
{
  "items": [
    {
      "id": "rdm_01",
      "voucher_id": "vch_01",
      "coupon_id": "cpn_01",
      "title": "Free Large Caramel Macchiato",
      "redeemed_at": "2026-08-13T19:00:00Z"
    }
  ]
}
```

---

## 10. Stories

Instagram-style rail on Home. Business creates frames on business web. Same approval pipeline. Default TTL 24h after publish.

### 10.1 Consumer

#### `GET /v1/stories`

**Auth:** consumer (to attach `seen`)

```json
{
  "items": [
    {
      "id": "sty_01",
      "store_id": "sto_sb",
      "name": "Starbucks",
      "logo_url": "https://cdn.stride.app/s/sb.png",
      "category": "Cafe",
      "time_ago": "2h",
      "seen": false,
      "expires_at": "2026-08-14T12:00:00Z",
      "cta_steps_cost": 35
    }
  ]
}
```

Unseen first, then `published_at` desc. Featured/buster stores may pin to front.

#### `GET /v1/stories/:id`

```json
{
  "id": "sty_01",
  "store_id": "sto_sb",
  "name": "Starbucks",
  "logo_url": "https://cdn.stride.app/s/sb.png",
  "category": "Cafe",
  "time_ago": "2h",
  "seen": false,
  "frames": [
    {
      "id": "frm_01",
      "image_url": "https://cdn.stride.app/st/1.jpg",
      "caption": "Morning pour. 3,500 steps = a Grande on us."
    }
  ],
  "store": {
    "id": "sto_sb",
    "name": "Starbucks",
    "short_desc": "Redeem your steps for premium coffee vouchers.",
    "full_desc": "Grande beverage at participating locations.",
    "logo_url": "https://cdn.stride.app/s/sb.png",
    "cover_url": "https://cdn.stride.app/s/sb-cover.jpg",
    "category": "Coffee",
    "min_steps_cost": 35
  }
}
```

#### `POST /v1/stories/:id/seen`

```json
{ "ok": true, "seen": true }
```

Replaces `@stride/seen_stories_v1`.

### 10.2 Business stories

#### `GET /v1/business/stories`

#### `POST /v1/business/stories`

```json
{
  "frames": [
    { "image_media_id": "med_10", "caption": "Morning pour." },
    { "image_media_id": "med_11", "caption": "Happy hour." }
  ]
}
```

`status=draft`

#### `PATCH /v1/business/stories/:id`

#### `POST /v1/business/stories/:id/submit`

#### `POST /v1/business/stories/:id/publish`

No token cost on the story itself. CTA uses store `min_steps_cost` / first published coupon.

#### `POST /v1/business/stories/:id/unpublish`

### 10.3 Admin stories

`GET /v1/admin/stories?status=pending_review`  
`POST /v1/admin/stories/:id/approve`  
`POST /v1/admin/stories/:id/reject` `{ "reason": "..." }`

---

## 11. Buster stores (paid featured)

Paid boost: store ranks first on Store + Home partners, `buster: true` badge.

### Products

| sku | Duration | Suggested USD |
|---|---|---|
| `boost_7d` | 7 days | 29 |
| `boost_30d` | 30 days | 79 |
| `boost_pin` | 7 days + pin slot 1 | 99 |

One **active** boost per store. Buying while active **extends** `featured_until` (add duration). Admin comps allowed.

Checkout lives on **business web**. Consumer app only reads `featured` / `buster`.

### `GET /v1/billing/products`

**Auth:** merchant

```json
{
  "items": [
    { "sku": "boost_7d", "name": "Buster 7 days", "duration_days": 7, "price_usd": 29, "pin": false },
    { "sku": "boost_30d", "name": "Buster 30 days", "duration_days": 30, "price_usd": 79, "pin": false },
    { "sku": "boost_pin", "name": "Buster Pin", "duration_days": 7, "price_usd": 99, "pin": true }
  ]
}
```

### `POST /v1/billing/checkout`

**Auth:** merchant. Store must be `published`.

```json
{
  "sku": "boost_7d",
  "success_url": "https://business.stride.app/boost/done",
  "cancel_url": "https://business.stride.app/boost"
}
```

```json
{
  "checkout_url": "https://checkout.stripe.com/c/session_...",
  "session_id": "cs_..."
}
```

### `GET /v1/billing/boosts`

```json
{
  "active": {
    "id": "bst_01",
    "sku": "boost_7d",
    "featured_until": "2026-08-20T00:00:00Z",
    "pin": false,
    "status": "active"
  },
  "history": []
}
```

### `POST /v1/billing/webhooks/stripe`

**Auth:** Stripe signature. No JWT.

Handle `checkout.session.completed`:

1. Verify signature.
2. Mark boost `paid`.
3. Set store `featured=true`, `featured_until += duration` (or now+duration).
4. If `boost_pin`, set `featured_pin=true` until end.

Idempotent on `session_id`.

### Admin comps

#### `POST /v1/admin/stores/:id/boost`

```json
{ "sku": "boost_7d", "reason": "Launch partner" }
```

#### `DELETE /v1/admin/stores/:id/boost`

Revoke: `featured=false`, `featured_until=null`.

---

## 12. Workouts

Active session can stay on-device. Persist on finish. `lastWorkoutSummary` must be server-backed (today it is lost on restart).

### `POST /v1/workouts`

Optional start.

```json
{ "started_at": "2026-08-13T17:00:00Z", "map_view": "neon" }
```

```json
{ "id": "wko_01", "status": "active" }
```

### `PATCH /v1/workouts/:id`

```json
{ "paused": true }
```

### `POST /v1/workouts/:id/finish`

```json
{
  "ended_at": "2026-08-13T17:42:15Z",
  "duration_seconds": 2535,
  "distance_km": 3.84,
  "calories_kcal": 312,
  "avg_speed_kmh": 5.2,
  "steps": 5683,
  "route": [{ "x": 150, "y": 300 }]
}
```

Server computes `tokens_earned = max(180, floor(distance_km * 65))`, inserts `workout_bonus`, creates notification.

```json
{
  "id": "wko_01",
  "status": "finished",
  "distance_km": 3.84,
  "duration_formatted": "42:15",
  "calories_kcal": 312,
  "avg_speed": 5.2,
  "steps": 5683,
  "tokens_earned": 249,
  "date": "Aug 13, 2026 • 05:42 PM",
  "wallet": { "balance": 449, "bonus_tokens": 429 }
}
```

### `GET /v1/workouts?cursor=`

History for Performance reports.

### `GET /v1/workouts/:id`

Summary screen + last workout.

### `GET /v1/workouts/last`

Last finished workout or `null`.

---

## 13. Leaderboard

Built from users with `privacy_visible=true` and today’s (or weekly) steps.

### `GET /v1/leaderboard?period=daily|weekly`

**Auth:** consumer

```json
{
  "period": "daily",
  "season_label": "SEASON 4",
  "items": [
    {
      "rank": 1,
      "user_id": "usr_99",
      "name": "Marcus T.",
      "steps": 21800,
      "avatar_url": "https://cdn.stride.app/u/99.jpg",
      "is_self": false,
      "status_text": "King of Stride!",
      "elevated": true
    },
    {
      "rank": 12,
      "user_id": "usr_01",
      "name": "Felix K.",
      "steps": 8420,
      "avatar_url": "https://cdn.stride.app/u/01.jpg",
      "is_self": true,
      "status_text": "Keep walking",
      "elevated": false
    }
  ],
  "self": { "rank": 12, "steps": 8420 }
}
```

If `privacy_visible=false`, omit from `items` but still return `self`.

---

## 14. Notifications

### `GET /v1/notifications?cursor=`

```json
{
  "items": [
    {
      "id": "ntf_01",
      "title": "Goal Reached!",
      "body": "You hit 16,000 steps today!",
      "category": "milestone",
      "action_type": "none",
      "coupon_code": null,
      "read": false,
      "created_at": "2026-08-13T18:00:00Z",
      "time_ago": "2m"
    }
  ],
  "unread_count": 2,
  "next_cursor": null
}
```

`category`: `alert` | `milestone` | `coupon` | `summary`  
`action_type`: `reclaim` | `view_coupon` | `none`

Server emits: daily goal, workout finish, purchase, admin (leaderboard overtake optional later).

### `POST /v1/notifications/:id/read`

```json
{ "ok": true }
```

### `POST /v1/notifications/read-all`

```json
{ "ok": true, "unread_count": 0 }
```

### `POST /v1/notifications/push-token`

```json
{ "platform": "ios", "token": "fcm-or-apns" }
```

Honor `prefs.notifications_enabled`. Skip push if false.

---

## 15. Devices

Metadata only. Health Connect / Apple Health permissions stay on-device. After connect, app calls `/v1/health/sync` with that `source`.

**Android:** the consumer app must show the Health Connect wall before Main UI. `POST /v1/devices/health_connect/connect` is called only after the wall succeeds. See §1.2.1.

### `GET /v1/devices`

```json
{
  "items": [
    { "id": "apple", "name": "Apple Health", "connected": false, "last_sync": null },
    { "id": "health_connect", "name": "Health Connect", "connected": true, "last_sync": "2026-08-13T18:00:00Z" },
    { "id": "fitbit", "name": "Fitbit", "connected": false, "last_sync": null }
  ]
}
```

### `POST /v1/devices/:id/connect`

```json
{ "id": "health_connect", "connected": true, "last_sync": "2026-08-13T18:01:00Z" }
```

### `POST /v1/devices/:id/disconnect`

### `POST /v1/devices/:id/sync`

Records `last_sync=now`. Does not pull Fitbit OAuth in P0 (flag for later).

---

## 16. Media

### `POST /v1/media/uploads`

**Auth:** any logged-in

```json
{
  "kind": "avatar",
  "content_type": "image/jpeg",
  "byte_size": 240000
}
```

`kind`: `avatar` | `logo` | `cover` | `coupon` | `story_frame`

```json
{
  "media_id": "med_01",
  "upload_url": "https://s3.amazonaws.com/...",
  "headers": { "Content-Type": "image/jpeg" },
  "expires_in": 300
}
```

Client PUT bytes to `upload_url`, then send `media_id` on PATCH/POST.

Max 8MB. Images only. Virus/type check on complete.

### `POST /v1/media/:id/complete`

```json
{ "id": "med_01", "url": "https://cdn.stride.app/u/med_01.jpg", "status": "ready" }
```

---

## 17. Admin extras

### `GET /v1/admin/queue`

Unified review: stores, coupons, stories with `pending_review`.

```json
{
  "items": [
    { "type": "coupon", "id": "cpn_09", "title": "20% Off Lunch", "store_name": "Bloom Cafe", "submitted_at": "2026-08-13T10:05:00Z" },
    { "type": "story", "id": "sty_04", "title": "2 frames", "store_name": "Daily Grind", "submitted_at": "2026-08-13T11:00:00Z" }
  ]
}
```

### `GET /v1/admin/users?q=`

### `POST /v1/admin/users/:id/suspend`

### `POST /v1/admin/ledger/adjust`

```json
{
  "user_id": "usr_01",
  "amount": 50,
  "reason": "Support goodwill"
}
```

Inserts `admin_adjust`.

### Store review

`POST /v1/admin/stores/:id/approve`  
`POST /v1/admin/stores/:id/reject` `{ "reason": "..." }`  
`POST /v1/admin/stores/:id/suspend`

---

## 18. App integration map

| Screen | Endpoints |
|---|---|
| Login / Register / Forgot | `POST /auth/login` `register` `forgot-password` |
| Boot / splash | `GET /me` |
| Home | `GET /health/today` `GET /health/weekly` `GET /stories` `GET /stores?featured=true` `GET /notifications` (badge) `GET /wallet` |
| Stories viewer | `GET /stories/:id` `POST /stories/:id/seen` → Brand: `GET /stores/:id` |
| Store | `GET /coupons` `GET /stores` `GET /wallet` |
| Brand store | `GET /stores/:id` |
| Coupon detail | `GET /coupons/:id` `POST /coupons/:id/purchase` |
| Wallet | `GET /wallet` `GET /wallet/vouchers` |
| Secure verification | `GET /wallet/vouchers/:id` |
| Track | local timer; `POST /workouts` optional; `POST /workouts/:id/finish` |
| Workout summary | `GET /workouts/:id` or `/workouts/last` |
| Performance | `GET /health/series` `GET /workouts` `GET /health/weekly` |
| Scoreboard | `GET /leaderboard?period=daily` |
| Inbox | `GET /notifications` `POST /notifications/:id/read` `read-all` |
| Profile / Edit | `GET /me` `PATCH /me` `PATCH /me/profile` `PATCH /me/prefs` `POST /media/uploads` |
| Health setup | device permissions on-device; then `POST /health/sync` `POST /devices/:id/connect` |
| Android HC wall | Blocks app until Health Connect ready (§1.2.1); then `POST /devices/health_connect/connect` + `POST /health/sync` |
| Connected devices | `GET /devices` connect/disconnect/sync |
| Merchant manager (app) | deep-link business web **or** `GET /business/coupons` read-only |
| Merchant scanner | `POST /redemptions/scan` |
| Business web | `/business/*` + `/billing/*` + media |
| Admin | `/admin/*` |

Home metrics: use `/health/today` + `/wallet`, not local `balanceFromParts`.

---

## 19. Phases 0 → hero

### P0 — Consumer core

Auth, `/me`, health sync + cap, ledger, public stores + coupons, purchase, wallet vouchers.

**App:** replace AuthContext + token display + Store/Wallet purchase.

### P1 — Business + approval

Store submit, coupon draft/submit, admin approve/reject, publish with `steps_cost`. Catalog = published only.

**Business web:** first ship. In-app create coupon → link out.

### P2 — Stories

Business frames, admin review, publish, 24h expiry, seen, Home rail.

### P3 — Workouts, leaderboard, inbox

Finish workout + bonus ledger, persist summary, leaderboard + `privacy_visible`, notifications + unread badge.

### P4 — Buster

Stripe products, checkout, webhook, featured sort, admin comps.

### P5 — Redeem + hardening

Scan API, signed QR TTL, anti-cheat (step cap, rate limit, anomaly), push tokens, Fitbit OAuth later.

---

## 20. Suggested Postgres tables

```
users
profiles
prefs
refresh_tokens
stores
coupons
stories
story_frames
vouchers
redemptions
ledger_entries
daily_steps
workouts
notifications
devices
media
boosts
push_tokens
admin_audit
```

Indexes: `daily_steps(user_id, date)` unique, `ledger_entries(user_id, created_at)`, `coupons(status, published_at)`, `stores(featured, featured_until)`, `vouchers(redemption_code)` unique.

---

## 21. Endpoint index

| Method | Path | Role |
|---|---|---|
| POST | `/v1/auth/register` | public |
| POST | `/v1/auth/login` | public |
| POST | `/v1/auth/refresh` | public |
| POST | `/v1/auth/logout` | user |
| POST | `/v1/auth/forgot-password` | public |
| POST | `/v1/auth/reset-password` | public |
| GET | `/v1/me` | user |
| PATCH | `/v1/me` | user |
| PATCH | `/v1/me/profile` | user |
| PATCH | `/v1/me/prefs` | user |
| POST | `/v1/health/sync` | consumer |
| GET | `/v1/health/today` | consumer |
| GET | `/v1/health/weekly` | consumer |
| GET | `/v1/health/series` | consumer |
| GET | `/v1/wallet` | consumer |
| GET | `/v1/wallet/ledger` | consumer |
| GET | `/v1/wallet/vouchers` | consumer |
| GET | `/v1/wallet/vouchers/:id` | consumer |
| GET | `/v1/stores` | public |
| GET | `/v1/stores/:id` | public |
| GET | `/v1/business/store` | merchant |
| PATCH | `/v1/business/store` | merchant |
| POST | `/v1/business/store/submit` | merchant |
| GET | `/v1/coupons` | public |
| GET | `/v1/coupons/:id` | public |
| POST | `/v1/coupons/:id/purchase` | consumer |
| GET | `/v1/business/coupons` | merchant |
| POST | `/v1/business/coupons` | merchant |
| PATCH | `/v1/business/coupons/:id` | merchant |
| POST | `/v1/business/coupons/:id/submit` | merchant |
| POST | `/v1/business/coupons/:id/publish` | merchant |
| POST | `/v1/business/coupons/:id/unpublish` | merchant |
| GET | `/v1/admin/coupons` | admin |
| POST | `/v1/admin/coupons/:id/approve` | admin |
| POST | `/v1/admin/coupons/:id/reject` | admin |
| POST | `/v1/redemptions/scan` | merchant |
| GET | `/v1/business/redemptions` | merchant |
| GET | `/v1/stories` | consumer |
| GET | `/v1/stories/:id` | consumer |
| POST | `/v1/stories/:id/seen` | consumer |
| GET | `/v1/business/stories` | merchant |
| POST | `/v1/business/stories` | merchant |
| PATCH | `/v1/business/stories/:id` | merchant |
| POST | `/v1/business/stories/:id/submit` | merchant |
| POST | `/v1/business/stories/:id/publish` | merchant |
| POST | `/v1/business/stories/:id/unpublish` | merchant |
| GET | `/v1/admin/stories` | admin |
| POST | `/v1/admin/stories/:id/approve` | admin |
| POST | `/v1/admin/stories/:id/reject` | admin |
| GET | `/v1/billing/products` | merchant |
| POST | `/v1/billing/checkout` | merchant |
| GET | `/v1/billing/boosts` | merchant |
| POST | `/v1/billing/webhooks/stripe` | stripe |
| POST | `/v1/admin/stores/:id/boost` | admin |
| DELETE | `/v1/admin/stores/:id/boost` | admin |
| POST | `/v1/workouts` | consumer |
| PATCH | `/v1/workouts/:id` | consumer |
| POST | `/v1/workouts/:id/finish` | consumer |
| GET | `/v1/workouts` | consumer |
| GET | `/v1/workouts/:id` | consumer |
| GET | `/v1/workouts/last` | consumer |
| GET | `/v1/leaderboard` | consumer |
| GET | `/v1/notifications` | consumer |
| POST | `/v1/notifications/:id/read` | consumer |
| POST | `/v1/notifications/read-all` | consumer |
| POST | `/v1/notifications/push-token` | consumer |
| GET | `/v1/devices` | consumer |
| POST | `/v1/devices/:id/connect` | consumer |
| POST | `/v1/devices/:id/disconnect` | consumer |
| POST | `/v1/devices/:id/sync` | consumer |
| POST | `/v1/media/uploads` | user |
| POST | `/v1/media/:id/complete` | user |
| GET | `/v1/admin/queue` | admin |
| GET | `/v1/admin/users` | admin |
| POST | `/v1/admin/users/:id/suspend` | admin |
| POST | `/v1/admin/ledger/adjust` | admin |
| POST | `/v1/admin/stores/:id/approve` | admin |
| POST | `/v1/admin/stores/:id/reject` | admin |
| POST | `/v1/admin/stores/:id/suspend` | admin |

---

## 22. Anti-cheat (P5)

- Max 50k steps/day; rate-limit sync to 12/hour.
- Reject decreasing-then-spiking patterns beyond threshold (flag, do not auto-ban).
- Purchase: row lock on `users`/`wallets`, idempotency key required.
- QR payload HMAC + 60s TTL; code still one-time.
- Mock source accepted only if `APP_ENV!=production` or user allowlisted.
