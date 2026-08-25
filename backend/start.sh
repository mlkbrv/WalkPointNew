#!/bin/sh
# Container entry point.
#
# Managed platforms (Render, Railway, Koyeb, Fly) hand the port in $PORT and will
# mark the deploy failed if nothing is listening on it. Locally there is no $PORT,
# so it defaults to 8000 and compose keeps working unchanged.
set -e

PORT="${PORT:-8000}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"

# Applying migrations here rather than in a separate release step keeps the
# single-service free tiers working: there is nowhere else to run them.
echo "Applying migrations..."
alembic upgrade head

# Idempotent, and the only way to get a first staff account on a host with no
# shell. Does nothing unless BOOTSTRAP_SUPERADMIN_* are set.
echo "Bootstrapping..."
python -m app.cli bootstrap

echo "Starting gunicorn on :$PORT with $WEB_CONCURRENCY worker(s)"
exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "0.0.0.0:$PORT" \
  --workers "$WEB_CONCURRENCY" \
  --timeout 60 \
  --graceful-timeout 30 \
  --access-logfile - \
  --error-logfile -
