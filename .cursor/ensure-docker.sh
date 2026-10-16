#!/usr/bin/env bash
# Start dockerd when systemd is unavailable (typical Cloud Agent VM).
# Safe to run more than once. Exits 0 when `docker info` succeeds.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed." >&2
  exit 1
fi

if docker info >/dev/null 2>&1; then
  exit 0
fi

sudo service docker start >/dev/null 2>&1 || true

if ! docker info >/dev/null 2>&1 && ! pgrep -x dockerd >/dev/null 2>&1; then
  sudo mkdir -p /etc/docker /var/run /var/lib/docker
  if [ ! -f /etc/docker/daemon.json ]; then
    printf '%s\n' '{' '  "storage-driver": "fuse-overlayfs"' '}' | sudo tee /etc/docker/daemon.json >/dev/null
  fi
  sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
fi

for _ in $(seq 1 30); do
  if [ -S /var/run/docker.sock ] && [ ! -w /var/run/docker.sock ]; then
    sudo chmod 666 /var/run/docker.sock || true
  fi
  if docker info >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "Docker daemon did not start. See /tmp/dockerd.log if present." >&2
exit 1
