# Deploying STRIDE

One VPS runs everything: Postgres, Redis, the API, the admin panel, and nginx in
front. Only nginx is reachable from the internet — Postgres and Redis are not
published at all, which is the single most common way a deployment like this gets
breached.

```
             :443
internet ──► nginx ─┬─► /v1/*   ──► backend (gunicorn + uvicorn workers)
                    ├─► /media/ ──► the media volume, straight off disk
                    └─► /*      ──► admin panel (static build)

                        backend ──► postgres, redis   (private network only)
                        worker  ──► postgres          (scheduled jobs, 1 replica)
```

## First deploy

Requirements: Docker with the compose plugin, a domain pointing at the server,
ports 80 and 443 open.

```bash
git clone <repo> stride && cd stride
```

**1. Fill in the secrets.**

```bash
cp .env.example .env                  # compose-level: database name, password, worker count
cp backend/.env.example backend/.env  # application-level: JWT secret, SMS, Firebase, storage
```

`JWT_SECRET` must be long and random — everything signed with it stays valid until
it changes, and changing it signs every user out:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

**2. Put the real hostname in nginx.**

`nginx/nginx.conf` ships with `stride.example.com` in three places. Replace all of
them; certbot writes its certificate under that exact name.

**3. Issue the certificate.**

nginx will not start without one, and certbot needs nginx to answer the ACME
challenge — so bring up the challenge path first with HTTP only.

```bash
docker compose up -d nginx           # serves /.well-known, redirects the rest
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d stride.example.com \
  --email ops@example.com --agree-tos --no-eff-email
docker compose restart nginx
```

**4. Start everything.**

```bash
docker compose up -d --build
```

The backend runs `alembic upgrade head` before its workers start, so a deploy
never serves code against a schema it does not have.

**5. Seed and create the first staff account.**

```bash
docker compose exec backend python -m app.cli seed
docker compose exec backend python -m app.cli create-superadmin ops@example.com '<a strong password>'
```

The admin panel is then at `https://stride.example.com`.

## Updating

```bash
git pull
docker compose up -d --build
```

Migrations run on start. Rolling back a release means checking out the previous
tag and rebuilding; **rolling back a migration is a separate, deliberate act**
(`docker compose exec backend alembic downgrade -1`) and is not something a deploy
should ever do on its own.

## What is where

| Path | Holds |
|---|---|
| volume `pgdata` | the database |
| volume `media` | uploaded images and video |
| volume `certbot-conf` | TLS certificates and renewal state |
| `backend/.env` | every application secret |

## Backups

The database and the media volume are the two things that cannot be rebuilt from
the repository. A nightly dump plus a volume copy:

```bash
docker compose exec -T postgres pg_dump -U stride stride | gzip > "backup-$(date +%F).sql.gz"
docker run --rm -v stride_media:/media -v "$PWD":/out alpine \
  tar czf /out/media-$(date +%F).tar.gz -C /media .
```

Restore is `gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U stride stride`.
Test it on a scratch server before you need it — an untested backup is a guess.

## Certificates

The `certbot` service loops `certbot renew` twice a day and exits non-zero on
failure, so a broken renewal shows up in `docker compose ps` rather than as an
expired certificate three months later. nginx picks up a renewed certificate on
reload:

```bash
docker compose exec nginx nginx -s reload
```

## Plugging in the external services

Both are stubbed until configured, and the app runs fine without them.

**SMS** — phone sign-in logs the code instead of sending it. Implement a backend
in `backend/app/integrations/sms.py`, then set `SMS_BACKEND` and the provider
credentials in `backend/.env`.

**Push (FCM)** — notifications land in the in-app inbox but nothing is pushed.
Mount the Firebase service-account JSON and point at it:

```yaml
# docker-compose.yml, service: backend
volumes:
  - ./secrets/firebase.json:/run/secrets/firebase.json:ro
```

```bash
# backend/.env
FCM_ENABLED=true
FIREBASE_CREDENTIALS_FILE=/run/secrets/firebase.json
```

## Moving media to S3

`MEDIA_ROOT` on a single box is the thing that stops this stack from running on
two. When that day comes, implement `Storage` from
`backend/app/storage/base.py`, register it in `factory.py`, and set
`STORAGE_BACKEND=s3`. Nothing above the storage layer knows where bytes live —
callers only ever handle a relative key.

## Health and logs

```bash
docker compose ps                 # health status per service
docker compose logs -f backend
curl -fsS https://stride.example.com/health
```

`/docs` and `/redoc` are restricted to private networks in `nginx.conf`. Reach
them over an SSH tunnel rather than opening them up:

```bash
ssh -L 8000:localhost:8000 user@server
```

## Scheduled jobs

The nightly coin roll-up, the story sweeper, and voucher expiry run in the
**`worker` service**, not in the API. gunicorn forks several API workers and each
would otherwise start its own scheduler, so every job would run once per worker —
hence `SCHEDULER_ENABLED=false` on `backend` and `true` on `worker`.

Exactly one `worker` replica may run. Scaling it is not a way to get more
throughput; it is a way to run every job twice.

```bash
docker compose logs -f worker      # each job logs its next run time on start
```
