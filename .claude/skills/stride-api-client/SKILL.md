---
name: stride-api-client
description: Wiring the Expo app in mobile-app/ to the FastAPI backend — replacing mock data and AsyncStorage state with real API calls, token storage and refresh, loading/error states. Use when connecting a screen to the server, removing mockData.ts, touching the api client, handling 401/refresh, or migrating an "@stride/..." AsyncStorage key to an endpoint.
---

# Connecting the mobile app to the API

The app currently runs on mock data (`mobile-app/src/utils/mockData.ts`, `stories.ts`) and
AsyncStorage. This skill governs how that is replaced, one screen at a time.

## Migration map

| Local key | Becomes |
|---|---|
| `@stride/auth_user` | JWT pair + `GET /v1/auth/me` |
| `@stride/app_state_v3` | coin ledger + resource endpoints (wallet, coupons, inbox, workouts) |
| `@stride/seen_stories_v1` | `POST /v1/stories/{id}/seen` |
| `@stride/health_mock_v2` | stays local — dev mock only, never shipped as truth |
| `@stride/health_connect_gate_v1` | stays local, plus `POST /v1/devices/health_connect/connect` |

## Layering — non-negotiable

**Screens never call the network.** Screen → context/hook (`useAuth`, `useHealth`, `useStride`)
→ api client. A new server call is a new method on a context, not a `fetch` in a `useEffect`.
This is what keeps the web (Vite shim) build and the native build identical.

## The client

One module owning all HTTP:

- Base URL from env (`.env`, via `expo-constants`) — never a literal in a screen.
- Injects `Authorization: Bearer <access>`.
- Parses the `{"error": {code, message}}` envelope into a typed error carrying `code`, so screens
  can branch on `INSUFFICIENT_COINS` vs `SOLD_OUT` instead of matching message strings.
- **Single-flight refresh**: on 401, one refresh call runs while concurrent requests queue on it;
  success replays them, failure clears the session and routes to login. Refresh tokens rotate
  server-side, so never fire two refreshes with the same token.
- Timeouts and an `AbortController` cancelled on unmount.
- Tokens via `src/api/tokenStore` — SecureStore on device, AsyncStorage on the web,
  chosen by file extension rather than a runtime branch.

## Cache, not source of truth

AsyncStorage becomes a render-fast cache: paint from cache, revalidate, replace. After any
mutation the server response is authoritative. `balanceFromParts` in
`mobile-app/src/utils/metrics.ts` may drive an optimistic number for a moment, but the balance
that persists is the one the server returns — the ledger is the truth.

## Never

- Invent request or response fields absent from `docs/BACKEND_API.md`.
- Treat a client-computed coin balance as real.
- Create catalogue content from the consumer app — `CreateCouponScreen` and
  `MerchantManagerScreen` become read-only or deep-link to the admin panel.
- Generate a redemption code, voucher id, or any other id on the client.
- Send raw step counts as an award — the app reports steps, the server decides coins.

## What is already wired

`src/api/client.ts` + `endpoints.ts`, `AuthContext` (email, SMS, refresh),
`ServerDataContext` (wallet, ledger, vouchers, stores, coupons, stories, inbox),
`useStepSync`, `usePushRegistration`, and these screens: Wallet, Store,
CouponDetail (incl. purchase), BrandStore, Stories, Inbox, HelpSupport,
SupportChat, and the Home rail and partner strip.

## Still on mocks

`ScoreboardScreen`, the workout screens, and the merchant screens. The first two
are blocked on endpoints the API does not have (leaderboard, workouts); the
merchant screens are superseded by the partner console in `admin-panel/`.

Every migrated screen gains **loading, empty, and error** states — see the checklist in
**stride-ui-design**. Screen and navigation mechanics: **stride-expo-screens**. Server side of
the same contract: **stride-backend-fastapi**.
