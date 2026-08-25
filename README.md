# STRIDE — Step-to-Earn

Walk, earn coins, spend them on partner coupons. Three projects in one repository.

| Folder | What it is | Stack |
|---|---|---|
| [`mobile-app/`](mobile-app) | Consumer app (also runs in a browser) | Expo SDK 57, React Native 0.86, React 19, TypeScript |
| [`backend/`](backend) | API, economy, moderation, push | FastAPI, PostgreSQL, SQLAlchemy 2.0 async, Alembic |
| [`admin-panel/`](admin-panel) | Superadmin + partner web console | React 18, Vite, TypeScript, MUI 6 |

`docs/BACKEND_API.md` is the API contract shared by all three.

* [`DEPLOY_FREE.md`](DEPLOY_FREE.md) — get it online for nothing (Neon + Render + Cloudflare Pages + Expo Go)
* [`DEPLOYMENT.md`](DEPLOYMENT.md) — one VPS, Docker, nginx, TLS

## Local development

Start the two data stores, then run each project on the host with hot reload:

```bash
docker compose -f docker-compose.dev.yml up -d
```

```bash
cd backend && cp .env.example .env && pip install -e ".[dev]" && alembic upgrade head && python -m app.cli seed && uvicorn app.main:app --reload
```

```bash
cd admin-panel && npm install && npm run dev
```

```bash
cd mobile-app && npm install && npm start
```

The mobile app also runs in a browser with `npm run dev` — useful for quick
iteration, though device features (real pedometer, push, secure token storage)
only exist in the Expo build.

Both web projects proxy `/v1` to `http://localhost:8000`, so nothing needs CORS
configuration to click around locally.

## Core rules

1. The coin ledger is **append-only** — a balance is `SUM(coin_transactions.amount)`, never a stored number.
2. Steps become coins only through the sync endpoint and the nightly roll-up, using the
   threshold and rate stored in `economy_settings` (defaults: 5000 steps → 50 coins, +10 per extra 1000).
3. Implausible step days are flagged, never auto-blocked; a superadmin releases the coins.
4. Coupons and stories are visible to users only once **approved**.
5. Redemption codes are generated server-side only.
6. A partner can only ever read and write their own business's content.
7. Push delivery is best-effort and must never fail or roll back the caller.

Project conventions for agents live in [`.claude/skills/`](.claude/skills).
