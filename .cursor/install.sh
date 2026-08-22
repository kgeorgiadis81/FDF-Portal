#!/usr/bin/env bash
# Idempotent Cloud Agent install for the FDF Portal.
#
# The Angular 22 CLI requires Node >= v22.22.3 / v24.15. Some base images ship an
# older default `node` on PATH, so we ensure Node 24 via nvm and make login shells
# prefer it (tmux/agent shells are login shells). This is safe to run repeatedly.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 24 >/dev/null
  nvm alias default 24 >/dev/null
  NODE24_BIN="$(dirname "$(nvm which 24)")"
  if [ -n "${NODE24_BIN:-}" ] && ! grep -qF "$NODE24_BIN" "$HOME/.bashrc" 2>/dev/null; then
    printf '\n# Node 24 for the Angular 22 CLI (base image default node may be too old)\nexport PATH="%s:$PATH"\n' "$NODE24_BIN" >> "$HOME/.bashrc"
  fi
  export PATH="$NODE24_BIN:$PATH"
fi

node -v

if [ -f e2e/.env.test.example ] && [ ! -f e2e/.env.test ]; then
  cp e2e/.env.test.example e2e/.env.test
fi

npm ci
npx playwright install chromium
