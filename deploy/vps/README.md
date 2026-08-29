# Deploying STRIDE to a VPS

For a plain Linux box you have root on — including one that is **already
running something else**.

## The short version

On the server, as root:

```bash
curl -fsSL https://raw.githubusercontent.com/mlkbrv/WalkPointNew/main/deploy/vps/bootstrap.sh | bash
```

It installs Docker if missing, clones to `/opt/stride`, generates every secret,
brings the stack up, waits for the API to answer, and prints the admin URL and
the first superadmin password.

Re-run the same command later to upgrade — it pulls, rebuilds, and restarts
without rotating any secret.

## What it will not do

**It will not touch the other project on the box.** Concretely:

- Every container, volume and network is namespaced under the compose project
  `stride`, so nothing collides with an existing stack.
- It checks what is listening on `:80` and `:443` *before* binding anything. If
  either is taken it uses `8080`/`8443` instead and says so.
- Postgres and Redis are never published to the host, let alone the internet.

## Two things worth understanding

### There is no domain, so there is a hostname trick

Let's Encrypt will not issue a certificate for a bare IP address. `sslip.io`
resolves any `A-B-C-D.sslip.io` to that address, so `89.117.49.72` becomes
`89-117-49-72.sslip.io` — a real name, which a real certificate can cover. The
script does this automatically.

When you have a real domain, point it at the box and re-run with:

```bash
STRIDE_HOST=api.yourdomain.com bash /opt/stride/deploy/vps/bootstrap.sh
```

### TLS depends on owning port 80

ACME's HTTP-01 challenge is always answered on `:80` and cannot be redirected.
So:

- **`:80` free** → a real Let's Encrypt certificate, renewed automatically.
- **`:80` taken** → a self-signed certificate. Everything works, but browsers
  warn.

If the box's existing web server owns `:80`, the better fix is to put it in
front rather than leaving STRIDE self-signed. Add one vhost to it:

```nginx
server {
    listen 443 ssl;
    server_name stride.yourdomain.com;
    # ... your existing certificate directives ...

    client_max_body_size 64m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## After it is up

Point the mobile app at the new server and rebuild:

```bash
EXPO_PUBLIC_API_BASE_URL=https://89-117-49-72.sslip.io npx eas build -p android --profile preview
```

Day-to-day:

```bash
cd /opt/stride/deploy/vps
docker compose -p stride -f docker-compose.vps.yml ps
docker compose -p stride -f docker-compose.vps.yml logs -f backend
docker compose -p stride -f docker-compose.vps.yml down      # stop, keep data
```

## Optional: real SMS and push

Both are off by default and the app works without them — SMS codes are logged
instead of sent, and notifications appear in the in-app inbox but do not reach
the lock screen.

**Push (Firebase):** put the service-account JSON at
`/opt/stride/backend/firebase-credentials.json`, set `FCM_ENABLED=true` in
`/opt/stride/backend/.env`, and restart. For Android delivery the app also needs
`google-services.json` in `mobile-app/` at build time.

**SMS (Twilio):** set `SMS_BACKEND=twilio` plus the three `TWILIO_*` values in
the same file, and restart.

## Backups

The database lives in the `stride_pgdata` volume. Nothing backs it up for you:

```bash
docker compose -p stride -f docker-compose.vps.yml exec -T postgres \
  pg_dump -U stride stride | gzip > "stride-$(date +%F).sql.gz"
```
