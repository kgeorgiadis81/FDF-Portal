#!/usr/bin/env bash
# Per-boot Cloud Agent start: Docker, E2E MariaDB, and a seeded FDF_DB_E2E.
#
# The e2e API (port 3501) and the portal e2e server (port 4201) are environment
# terminals. They wait on /tmp/fdf-e2e-ready, which this script writes only
# after `npm run e2e:setup` in the sibling FDF_Backend checkout.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$(cd "$ROOT/.." && pwd)/FDF_Backend"
READY_FILE=/tmp/fdf-e2e-ready

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null
fi

rm -f "$READY_FILE"

if [ ! -d "$BACKEND_DIR/.git" ]; then
  echo "FDF_Backend is not checked out at ${BACKEND_DIR}. Re-run .cursor/install.sh." >&2
  exit 0
fi

if [ ! -f "$BACKEND_DIR/.env.e2e" ]; then
  cp "$BACKEND_DIR/.env.e2e.example" "$BACKEND_DIR/.env.e2e"
fi
# Backend .env.e2e.example has `BREVO_SENDER_NAME=FDF E2E`. Bash `source`
# (used by scripts/e2e-db-guard.sh) treats the unquoted space as a command.
if [ -f "$BACKEND_DIR/.env.e2e" ] && grep -q '^BREVO_SENDER_NAME=FDF E2E$' "$BACKEND_DIR/.env.e2e"; then
  sed -i 's/^BREVO_SENDER_NAME=FDF E2E$/BREVO_SENDER_NAME="FDF E2E"/' "$BACKEND_DIR/.env.e2e"
fi

if ! bash "$ROOT/.cursor/ensure-docker.sh"; then
  echo "Docker daemon did not start. E2E MariaDB and the API need it." >&2
  exit 0
fi

if ! docker compose -f "$BACKEND_DIR/docker-compose.e2e.yml" up -d; then
  echo "WARNING: could not start E2E MariaDB." >&2
  exit 0
fi

echo "Waiting for E2E MariaDB (fdf-mariadb-e2e) on port 3307..."
ready=0
for _ in $(seq 1 30); do
  if docker exec fdf-mariadb-e2e healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "WARNING: E2E MariaDB did not become ready in time." >&2
  exit 0
fi

echo "Seeding FDF_DB_E2E (npm run e2e:setup)..."
if ! (cd "$BACKEND_DIR" && npm run e2e:setup); then
  echo "WARNING: e2e:setup failed. The API terminal will keep waiting." >&2
  exit 0
fi

touch "$READY_FILE"
echo "E2E database is seeded. API terminal may start on port 3501."
