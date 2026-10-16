#!/usr/bin/env bash
# Terminal: Portal e2e dev server on port 4201 (environment.e2e, API at :3501).
# Shares port 4201 with `npm start`, so the dev server is not started as well.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 24 >/dev/null
fi

export NG_CLI_ANALYTICS=false
exec npm run start:e2e
