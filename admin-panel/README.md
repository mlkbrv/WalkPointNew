# STRIDE admin panel

Web console for **superadmins** (moderation, economy, anti-fraud review, support)
and **partners** (their own coupons, stories, redemptions).

React 18 · Vite · TypeScript · MUI 6 · React Router 6.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/v1` and `/media` to
`http://localhost:8000`, so the browser stays same-origin and no CORS setup is
needed just to click around. For a deployed build set `VITE_API_BASE_URL` to the
API origin.

Sign in with a staff account:

```bash
cd ../backend && python -m app.cli create-superadmin admin@example.com a-strong-password
```

`POST /v1/auth/staff/login` rejects plain app accounts with `403`, so a consumer
cannot sign in here even with valid credentials.

## Layout

| Path | Role |
|---|---|
| `src/api/client.ts` | the only place that talks HTTP — auth header, error envelope, refresh |
| `src/api/endpoints.ts` | typed wrappers, grouped by audience |
| `src/api/types.ts` | response shapes mirroring `backend/app/schemas` |
| `src/auth/` | session state and the role split |
| `src/components/` | shell, shared table/dialog/state pieces |
| `src/pages/admin/` | superadmin screens |
| `src/pages/partner/` | partner screens |

## Two things worth knowing before changing it

**Single-flight refresh.** Refresh tokens rotate server-side — the presented one is
revoked on use — so firing two refreshes concurrently logs the user out. On a 401
the first caller refreshes and every other request waits on that same promise,
then all replay. Never add a second refresh path.

**Roles are separate route trees, not disabled buttons.** A partner is never given
the superadmin routes; an unknown path sends them to their own home. The server
enforces the same rules — this only stops the UI offering doors that would slam.

## Screens

**Superadmin** — dashboard with live queue counts · partner applications · coupon
review · story review · flagged step days (release or discard withheld coins) ·
support console · FAQ editor · economy settings · broadcast.

**Partner** — dashboard · coupons with the full draft → submit → withdraw
lifecycle · stories · redemption log · business profile.

Rejections require a reason everywhere the API requires one; the submit button
stays disabled until there is one, because the partner reads that text verbatim.

## Not yet wired

Media upload. Coupon images and story media take a stored key (`stories/x.jpg`)
for now; the upload endpoint arrives with the media/infrastructure step.
