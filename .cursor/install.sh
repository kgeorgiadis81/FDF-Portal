#!/usr/bin/env bash
# Idempotent Cloud Agent install for the FDF Portal.
#
# Prepares everything that must survive as files: Node 24, portal and sibling
# FDF_Backend dependencies, Playwright/Chrome, and Docker. Long-running
# processes (dockerd, MariaDB, the API, the dev server) belong in start.sh
# and the environment terminals.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 24 >/dev/null
  nvm alias default 24 >/dev/null
  NODE24_BIN="$(dirname "$(nvm which 24)")"
  if [ -n "${NODE24_BIN:-}" ]; then
    export PATH="$NODE24_BIN:$PATH"
    # ~/.bashrc on this image is sourced by login shells. Also write profile.d
    # so a stock bashrc that returns early for non-interactive shells still
    # sees Node 24 ahead of /exec-daemon/node (v22, which Angular 22 rejects).
    if ! grep -qF "$NODE24_BIN" "$HOME/.bashrc" 2>/dev/null; then
      printf '\n# Node 24 for the Angular 22 CLI (base image default node may be too old)\nexport PATH="%s:$PATH"\n' "$NODE24_BIN" >> "$HOME/.bashrc"
    fi
    sudo tee /etc/profile.d/fdf-node.sh >/dev/null <<EOF
export PATH="${NODE24_BIN}:\$PATH"
export NG_CLI_ANALYTICS=false
EOF
  fi
fi

node -v

# Angular CLI prompts for analytics consent on first interactive run, which would
# block a TTY terminal on a fresh Cloud Agent boot.
export NG_CLI_ANALYTICS=false
if ! grep -qF 'NG_CLI_ANALYTICS' "$HOME/.bashrc" 2>/dev/null; then
  printf '\n# Opt out of the Angular CLI analytics prompt (non-interactive Cloud Agent shells)\nexport NG_CLI_ANALYTICS=false\n' >> "$HOME/.bashrc"
fi

if [ -f e2e/.env.test.example ] && [ ! -f e2e/.env.test ]; then
  cp e2e/.env.test.example e2e/.env.test
fi

npm ci

# Chromium plus the OS libraries Playwright needs. Matches `npm run e2e`
# (project portal-chromium). Playwright invokes sudo for the apt packages;
# `sudo npx` itself fails because sudo's secure_path does not include nvm.
npx playwright install --with-deps chromium

if ! command -v google-chrome-stable >/dev/null 2>&1 && ! command -v google-chrome >/dev/null 2>&1; then
  curl -fsSL -o /tmp/google-chrome-stable.deb \
    https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold" \
    /tmp/google-chrome-stable.deb
  rm -f /tmp/google-chrome-stable.deb
fi

install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      -o Dpkg::Options::="--force-confdef" \
      -o Dpkg::Options::="--force-confold" \
      docker.io docker-compose-v2 iptables fuse3 fuse-overlayfs
    sudo groupadd -f docker
    sudo usermod -aG docker "${USER:-ubuntu}" || true
  fi

  # Nested Cloud Agent VMs need fuse-overlayfs; overlayfs whiteouts fail otherwise.
  sudo mkdir -p /etc/docker
  if [ ! -f /etc/docker/daemon.json ]; then
    printf '%s\n' '{' '  "storage-driver": "fuse-overlayfs"' '}' | sudo tee /etc/docker/daemon.json >/dev/null
  fi
  if command -v update-alternatives >/dev/null 2>&1 && [ -x /usr/sbin/iptables-legacy ]; then
    sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
    sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true
  fi
}

install_docker

if ! command -v dbmate >/dev/null 2>&1; then
  curl -fsSL -o /tmp/dbmate \
    "https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64"
  sudo install /tmp/dbmate /usr/local/bin/dbmate
  rm -f /tmp/dbmate
fi

if ! command -v mysql >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold" \
    default-mysql-client
fi

# repositoryDependencies grants the GitHub token access; it does not clone.
# Playwright and the e2e scripts expect FDF_Backend as a sibling of this repo.
BACKEND_DIR="$(cd "$ROOT/.." && pwd)/FDF_Backend"
if [ ! -d "$BACKEND_DIR/.git" ]; then
  sudo mkdir -p "$BACKEND_DIR"
  sudo chown "$(id -u):$(id -g)" "$BACKEND_DIR"
  if [ -n "$(ls -A "$BACKEND_DIR" 2>/dev/null || true)" ]; then
    echo "ERROR: ${BACKEND_DIR} exists but is not a git checkout." >&2
    exit 1
  fi
  gh repo clone kgeorgiadis81/FDF_Backend "$BACKEND_DIR"
else
  git -C "$BACKEND_DIR" fetch origin main
  git -C "$BACKEND_DIR" checkout main
  git -C "$BACKEND_DIR" pull --ff-only origin main
fi

if [ ! -f "$BACKEND_DIR/.env.e2e" ]; then
  cp "$BACKEND_DIR/.env.e2e.example" "$BACKEND_DIR/.env.e2e"
fi
# See start.sh: unquoted "FDF E2E" breaks `source .env.e2e` in the backend scripts.
if [ -f "$BACKEND_DIR/.env.e2e" ] && grep -q '^BREVO_SENDER_NAME=FDF E2E$' "$BACKEND_DIR/.env.e2e"; then
  sed -i 's/^BREVO_SENDER_NAME=FDF E2E$/BREVO_SENDER_NAME="FDF E2E"/' "$BACKEND_DIR/.env.e2e"
fi
if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

(cd "$BACKEND_DIR" && npm ci)

# Cache the MariaDB image on the snapshot disk. The daemon itself does not
# survive the snapshot; start.sh launches it again.
bash "$ROOT/.cursor/ensure-docker.sh"
docker compose -f "$BACKEND_DIR/docker-compose.e2e.yml" pull
