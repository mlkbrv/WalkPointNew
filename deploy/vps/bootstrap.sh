#!/usr/bin/env bash
#
# One-shot deploy of STRIDE onto a VPS that may already be hosting something.
#
# Run it on the server as root:
#
#     curl -fsSL https://raw.githubusercontent.com/mlkbrv/WalkPointNew/main/deploy/vps/bootstrap.sh | bash
#
# or, from a clone:  bash deploy/vps/bootstrap.sh
#
# What it guarantees:
#
#   * **It does not touch anything already running.** It looks at what holds
#     :80 and :443 before binding anything, and falls back to 8080/8443 if they
#     are taken. Its containers, volumes and network are all namespaced under
#     the compose project `stride`.
#   * **Secrets are generated here, not committed.** The database password, JWT
#     secret, cron secret and first admin password are made on the box with
#     `openssl rand` and written to a root-only `.env`. Re-running the script
#     keeps the existing ones rather than rotating them and locking you out.
#   * **It is re-runnable.** Every step checks before it acts, so running it
#     again after a `git pull` is the upgrade path.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/mlkbrv/WalkPointNew.git}"
APP_DIR="${APP_DIR:-/opt/stride}"
PROJECT="stride"

log()  { printf '\n\033[1;35m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m x\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run this as root (it installs packages and writes to $APP_DIR)."

# --- 1. Docker ---------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
else
  log "Docker already installed: $(docker --version)"
fi
docker compose version >/dev/null 2>&1 || die "docker compose v2 is required."

# --- 2. The code -------------------------------------------------------------
if [[ -d "$APP_DIR/.git" ]]; then
  log "Updating $APP_DIR"
  git -C "$APP_DIR" fetch --quiet origin
  git -C "$APP_DIR" reset --hard --quiet origin/main
else
  log "Cloning into $APP_DIR"
  git clone --quiet "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR/deploy/vps"

# --- 3. Ports ----------------------------------------------------------------
# `ss` is on every modern distro; fall back to netstat, then to assuming free.
port_busy() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$1 )" 2>/dev/null | grep -q LISTEN
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | grep -qE "[:.]$1[[:space:]]"
  else
    return 1
  fi
}

log "Checking which ports are free"
if port_busy 80 || port_busy 443; then
  HTTP_PORT=8080
  HTTPS_PORT=8443
  warn "Ports 80/443 are in use by the other project on this box."
  warn "STRIDE will listen on $HTTP_PORT/$HTTPS_PORT instead and leave it alone."
  warn "Note: Let's Encrypt cannot validate on a non-standard port, so TLS will"
  warn "be a self-signed certificate until you either free :80 or put the"
  warn "existing web server in front of http://127.0.0.1:$HTTP_PORT."
else
  HTTP_PORT=80
  HTTPS_PORT=443
  echo "  :80 and :443 are free — using them, with a real Let's Encrypt certificate."
fi

# ACME's HTTP-01 challenge is always answered on :80. If the stack could not
# take that port, a public certificate is unobtainable and Caddy would retry
# forever — so it issues its own instead. Browsers will warn; the API still
# speaks TLS, and the fix is to free :80 or front the stack with the existing
# web server.
if [[ "$HTTP_PORT" == "80" ]]; then
  : > tls.conf
else
  echo "tls internal" > tls.conf
fi

# --- 4. Hostname -------------------------------------------------------------
# Let's Encrypt will not issue for a bare IP. sslip.io resolves A-B-C-D.sslip.io
# to that address, which turns the IP into a name a certificate can cover.
PUBLIC_IP="${PUBLIC_IP:-$(curl -fsS --max-time 10 https://api.ipify.org || true)}"
[[ -n "$PUBLIC_IP" ]] || die "Could not determine this server's public IP; set PUBLIC_IP=... and re-run."
HOST="${STRIDE_HOST:-${PUBLIC_IP//./-}.sslip.io}"
log "Public hostname: $HOST  (IP $PUBLIC_IP)"

# Push works only with a Firebase service account, and there is no sensible
# default for one. Rather than shipping `FCM_ENABLED=true` and having every
# notification fail at send time, the flag follows whether the key is actually
# on disk — copy it to backend/secrets/firebase-admin.json and re-run.
if [[ -f "$APP_DIR/backend/secrets/firebase-admin.json" ]]; then
  FCM_ENABLED=true
  log "Firebase service account found — push enabled"
else
  FCM_ENABLED=false
  warn "No backend/secrets/firebase-admin.json — push disabled, inbox still works"
fi

# --- 5. Secrets --------------------------------------------------------------
ENV_FILE="$APP_DIR/backend/.env"
STACK_ENV="$APP_DIR/deploy/vps/.env"

# Reuse an existing value so re-running never rotates a secret out from under a
# running deployment (which would invalidate every session, or worse, orphan the
# database password).
keep() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- || true; }

if [[ -f "$ENV_FILE" ]]; then
  log "Reusing the secrets already in backend/.env"
  DB_PASS="$(keep POSTGRES_PASSWORD)"
  JWT="$(keep JWT_SECRET)"
  CRON="$(keep CRON_SECRET)"
  ADMIN_PASS="$(keep BOOTSTRAP_SUPERADMIN_PASSWORD)"
  FRESH=0
else
  log "Generating secrets"
  DB_PASS="$(openssl rand -hex 24)"
  JWT="$(openssl rand -hex 48)"
  CRON="$(openssl rand -hex 24)"
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  FRESH=1
fi

cat > "$ENV_FILE" <<ENVEOF
# Generated by deploy/vps/bootstrap.sh — do not commit.
APP_NAME=STRIDE API
ENVIRONMENT=production
DEBUG=false
API_V1_PREFIX=/v1

# The admin panel is served from the same origin as the API, so no cross-origin
# request is made and this list only needs the host itself.
CORS_ORIGINS=https://$HOST

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=stride
POSTGRES_USER=stride
POSTGRES_PASSWORD=$DB_PASS

REDIS_URL=redis://redis:6379/0

JWT_SECRET=$JWT
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=30
REFRESH_TOKEN_TTL_DAYS=30

SMS_BACKEND=mock
SMS_CODE_TTL_MINUTES=5

# Turned on automatically when the service-account key is present; see above.
FCM_ENABLED=$FCM_ENABLED
FIREBASE_CREDENTIALS_FILE=/app/secrets/firebase-admin.json

STORAGE_BACKEND=local
MEDIA_ROOT=/app/media
MEDIA_URL_PREFIX=/media

# Created on first boot only; an existing account is never modified, so
# re-running this script will not reset the password.
BOOTSTRAP_SUPERADMIN_EMAIL=admin@example.com
BOOTSTRAP_SUPERADMIN_PASSWORD=$ADMIN_PASS

CRON_SECRET=$CRON

# The worker service runs the schedule; the API processes must not.
SCHEDULER_ENABLED=true
DAILY_ROLLUP_HOUR=23
DAILY_ROLLUP_MINUTE=59
SERVER_TIMEZONE=Asia/Baku
ENVEOF
chmod 600 "$ENV_FILE"

cat > "$STACK_ENV" <<STACKEOF
POSTGRES_PASSWORD=$DB_PASS
STRIDE_HOST=$HOST
STRIDE_ACME_EMAIL=admin@$HOST
STRIDE_HTTP_PORT=$HTTP_PORT
STRIDE_HTTPS_PORT=$HTTPS_PORT
WEB_CONCURRENCY=3
STACKEOF
chmod 600 "$STACK_ENV"

# --- 6. Build and start ------------------------------------------------------
log "Building images (first run takes a few minutes)"
docker compose -p "$PROJECT" -f docker-compose.vps.yml build

log "Starting the stack"
docker compose -p "$PROJECT" -f docker-compose.vps.yml up -d

# --- 7. Wait for health ------------------------------------------------------
log "Waiting for the API to answer"
for attempt in $(seq 1 60); do
  if docker compose -p "$PROJECT" -f docker-compose.vps.yml exec -T backend \
       python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health',timeout=3).status==200 else 1)" \
       >/dev/null 2>&1; then
    echo "  healthy after ${attempt}0s"
    break
  fi
  [[ $attempt -eq 60 ]] && {
    docker compose -p "$PROJECT" -f docker-compose.vps.yml logs --tail 60 backend
    die "The API did not come up. Logs above."
  }
  sleep 10
done

SCHEME=https
if [[ "$HTTPS_PORT" == "443" ]]; then
  SUFFIX=""
else
  SUFFIX=":$HTTPS_PORT"
fi

cat <<DONEEOF

  STRIDE is up.

    Admin panel   $SCHEME://$HOST$SUFFIX/
    API docs      $SCHEME://$HOST$SUFFIX/docs
    Health        $SCHEME://$HOST$SUFFIX/health

DONEEOF

if [[ "$FRESH" == "1" ]]; then
  cat <<CREDEOF
  First superadmin — shown once, and only because this is a fresh install:

    email     admin@example.com
    password  $ADMIN_PASS

  Sign in and change it from the panel. The value also lives in
  $ENV_FILE (root-only).

CREDEOF
else
  echo "  Superadmin credentials unchanged. They are in $ENV_FILE."
  echo
fi

cat <<NEXTEOF
  Point the mobile app at this server by rebuilding it with:

    EXPO_PUBLIC_API_BASE_URL=$SCHEME://$HOST$SUFFIX

  Useful afterwards:

    docker compose -p $PROJECT -f $APP_DIR/deploy/vps/docker-compose.vps.yml ps
    docker compose -p $PROJECT -f $APP_DIR/deploy/vps/docker-compose.vps.yml logs -f backend
    bash $APP_DIR/deploy/vps/bootstrap.sh        # re-run to upgrade

NEXTEOF
