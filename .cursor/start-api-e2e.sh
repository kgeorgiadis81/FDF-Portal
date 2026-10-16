#!/usr/bin/env bash
# Terminal: FDF_Backend e2e API on port 3501.
# Waits until start.sh has seeded MariaDB (see /tmp/fdf-e2e-ready).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$(cd "$ROOT/.." && pwd)/FDF_Backend"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null
fi

echo "Waiting for /tmp/fdf-e2e-ready (MariaDB seed)..."
until [ -f /tmp/fdf-e2e-ready ]; do
  sleep 2
done

cd "$BACKEND_DIR"
exec npm run start:e2e
