#!/usr/bin/env bash
# Wait until an HTTP URL returns success. Used by CI after the e2e API and
# portal dev server are started (see .cursor/start-api-e2e.sh and
# .cursor/start-portal-e2e.sh).
set -euo pipefail

url="${1:?url required}"
name="${2:-service}"
attempts="${3:-90}"

for _ in $(seq 1 "$attempts"); do
  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "${name} is healthy at ${url}"
    exit 0
  fi
  sleep 2
done

echo "${name} did not become healthy at ${url} within $((attempts * 2))s" >&2
exit 1
