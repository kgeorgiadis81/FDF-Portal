#!/usr/bin/env bash
# Confirm the live Director Portal is serving this commit.
# HTTP 200 on the home page is not enough: version.json must name this commit
# and the hashed bundle from the build, index.html must reference that bundle,
# and the bundle response must be JavaScript rather than the SPA HTML fallback.
#
# Usage: smoke-portal-release.sh <base-url> <expected-commit> <local-version.json>
# Set SMOKE_ALLOW_INSECURE=1 to permit http:// (local tests only).
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: smoke-portal-release.sh <base-url> <commit> <local-version.json>" >&2
  exit 2
fi

base=${1%/}
commit=$2
local_json=$3

if [[ "$base" != https://* && "${SMOKE_ALLOW_INSECURE:-}" != "1" ]]; then
  echo "::error::Smoke URL must be https." >&2
  exit 1
fi
if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::Expected commit is not a 40-character hex sha." >&2
  exit 1
fi
if [[ ! -f "$local_json" ]]; then
  echo "::error::Local version.json is missing (${local_json})." >&2
  exit 1
fi

local_commit=$(jq -er '.commit' "$local_json")
local_asset=$(jq -er '.asset' "$local_json")
if [[ "$local_commit" != "$commit" ]]; then
  echo "::error::Local version.json commit does not match the commit being deployed." >&2
  exit 1
fi
if [[ ! "$local_asset" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "::error::Local version.json asset name is not a single safe filename." >&2
  exit 1
fi

# Retry connection failures only. A wrong commit fails immediately.
fetch() {
  local url=$1
  local dest=$2
  local attempt rc
  rc=1
  for attempt in 1 2 3; do
    if curl -fsS --max-time 20 -o "$dest" "$url"; then
      return 0
    fi
    rc=$?
    if [[ "$rc" -eq 22 ]]; then
      return "$rc"
    fi
    sleep 2
  done
  return "$rc"
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

if ! fetch "${base}/version.json" "${work}/version.json"; then
  echo "::error::Could not fetch ${base}/version.json." >&2
  exit 1
fi
remote_commit=$(jq -er '.commit' "${work}/version.json" 2>/dev/null || true)
remote_asset=$(jq -er '.asset' "${work}/version.json" 2>/dev/null || true)
if [[ "$remote_commit" != "$commit" || "$remote_asset" != "$local_asset" ]]; then
  echo "::error::Live version.json does not match this commit's marker. Expected commit ${commit} and asset ${local_asset}." >&2
  exit 1
fi

if ! fetch "${base}/" "${work}/index.html"; then
  echo "::error::Could not fetch the portal home page." >&2
  exit 1
fi
if ! grep -F -q "$local_asset" "${work}/index.html"; then
  echo "::error::Live index.html does not reference ${local_asset}." >&2
  exit 1
fi

headers="${work}/asset.headers"
if ! curl -fsS --max-time 20 -D "$headers" -o "${work}/asset.js" "${base}/${local_asset}"; then
  echo "::error::Could not fetch hashed asset ${local_asset}." >&2
  exit 1
fi
ctype=$(grep -i '^content-type:' "$headers" | head -n 1 || true)
if ! printf '%s' "$ctype" | grep -qi 'javascript'; then
  echo "::error::Hashed asset Content-Type is not JavaScript (${ctype:-missing})." >&2
  exit 1
fi
if [[ ! -s "${work}/asset.js" ]]; then
  echo "::error::Hashed asset ${local_asset} is empty." >&2
  exit 1
fi
if head -c 64 "${work}/asset.js" | grep -qi '<!doctype\|<html'; then
  echo "::error::Hashed asset ${local_asset} looks like HTML. nginx may be serving the SPA fallback." >&2
  exit 1
fi

echo "Smoke passed for ${commit} (${local_asset})."
