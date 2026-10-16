#!/usr/bin/env bash
# Activate, roll back, or prune Director Portal releases on the VPS.
#
# Layout (nginx must use the `current` symlink as its root — see the playbook):
#   /var/www/fdf/portal/releases/<40-hex-commit>/
#   /var/www/fdf/portal/current -> releases/<commit>
#
# The deploy workflow pipes this file to `bash -s` over SSH. It does not read
# secrets. `activate` prints a single stdout line: `FDF_PREVIOUS <path|none>`.
# Everything else goes to stderr.
set -euo pipefail

PORTAL_ROOT="${PORTAL_ROOT:-/var/www/fdf/portal}"
PORTAL_ROOT="${PORTAL_ROOT%/}"
RELEASES="${PORTAL_ROOT}/releases"

usage() {
  echo "usage: portal-release.sh activate <sha> | rollback <path|none> | prune [keep]" >&2
  exit 2
}

# Release directories are named with the full git commit.
require_sha() {
  local sha=$1
  if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Release id must be a 40-character lowercase hex commit." >&2
    exit 1
  fi
}

# Point `current` at target with an atomic rename of a new symlink.
switch_current() {
  local target=$1
  local tmp="${PORTAL_ROOT}/current.next"
  if [[ -L "$tmp" ]]; then
    rm -f -- "$tmp"
  elif [[ -e "$tmp" ]]; then
    echo "Refusing to replace leftover ${tmp}." >&2
    exit 1
  fi
  ln -s "$target" "$tmp"
  mv -Tf "$tmp" "${PORTAL_ROOT}/current"
}

# Publish an already-uploaded release. Does not delete other releases.
cmd_activate() {
  local sha=$1
  require_sha "$sha"
  local dir="${RELEASES}/${sha}"
  if [[ -L "$dir" || ! -d "$dir" ]]; then
    echo "Release directory does not exist: ${dir}" >&2
    exit 1
  fi
  if [[ ! -s "${dir}/index.html" || ! -s "${dir}/version.json" ]]; then
    echo "Release is missing index.html or version.json. current was not changed." >&2
    exit 1
  fi
  if ! grep -q -F "\"commit\":\"${sha}\"" "${dir}/version.json"; then
    echo "version.json commit does not match the release directory. current was not changed." >&2
    exit 1
  fi

  local prev="none"
  if [[ -L "${PORTAL_ROOT}/current" ]]; then
    prev=$(readlink -f "${PORTAL_ROOT}/current")
  elif [[ -e "${PORTAL_ROOT}/current" ]]; then
    echo "Refusing to replace ${PORTAL_ROOT}/current because it is not a symlink." >&2
    exit 1
  fi

  switch_current "$dir"
  echo "Activated ${sha} (previous: ${prev})" >&2
  printf 'FDF_PREVIOUS %s\n' "$prev"
}

# Point `current` back at a previous release, or remove it when there was none.
cmd_rollback() {
  local target=$1
  if [[ "$target" == "none" ]]; then
    if [[ -L "${PORTAL_ROOT}/current" ]]; then
      rm -f -- "${PORTAL_ROOT}/current"
      echo "Removed current; there was no previous release." >&2
      return 0
    fi
    if [[ -e "${PORTAL_ROOT}/current" ]]; then
      echo "Refusing to remove current because it is not a symlink." >&2
      exit 1
    fi
    echo "current is already absent." >&2
    return 0
  fi

  if [[ "$target" != "${RELEASES}/"* || "$target" == *".."* ]]; then
    echo "Rollback target is outside the releases directory." >&2
    exit 1
  fi
  local name
  name=$(basename -- "$target")
  require_sha "$name"
  local dir="${RELEASES}/${name}"
  if [[ -L "$dir" || ! -d "$dir" ]]; then
    echo "Previous release directory is missing. current was not changed." >&2
    exit 1
  fi
  local canon
  canon=$(readlink -f "$dir")
  if [[ "$canon" != "$dir" ]]; then
    echo "Rollback target is not a real release directory." >&2
    exit 1
  fi
  switch_current "$dir"
  echo "Rolled current back to ${dir}" >&2
}

# Keep the newest N commit-named release directories. Never delete the
# directory that `current` points at, even when it is older than those N.
cmd_prune() {
  local keep=$1
  if [[ ! "$keep" =~ ^[0-9]+$ ]] || (( keep < 1 || keep > 20 )); then
    echo "Keep count must be an integer from 1 to 20." >&2
    exit 1
  fi
  if [[ ! -d "$RELEASES" ]]; then
    echo "No releases directory; nothing to prune." >&2
    return 0
  fi

  local live=""
  if [[ -L "${PORTAL_ROOT}/current" ]]; then
    local live_path
    live_path=$(readlink -f "${PORTAL_ROOT}/current")
    live=$(basename -- "$live_path")
  fi

  local -a ordered=()
  local name
  while IFS=$'\t' read -r _ name; do
    if [[ "$name" =~ ^[0-9a-f]{40}$ ]]; then
      ordered+=("$name")
    fi
  done < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@\t%f\n' | sort -nr)

  declare -A keep_set=()
  local count=0
  for name in "${ordered[@]}"; do
    if (( count < keep )); then
      keep_set["$name"]=1
      count=$((count + 1))
    fi
  done
  if [[ -n "$live" && "$live" =~ ^[0-9a-f]{40}$ ]]; then
    keep_set["$live"]=1
  fi

  for name in "${ordered[@]}"; do
    if [[ -z "${keep_set[$name]:-}" ]]; then
      rm -rf -- "${RELEASES}/${name}"
      echo "Pruned ${name}" >&2
    fi
  done
}

main() {
  local cmd=${1:-}
  case "$cmd" in
    activate)
      [[ $# -eq 2 ]] || usage
      cmd_activate "$2"
      ;;
    rollback)
      [[ $# -eq 2 ]] || usage
      cmd_rollback "$2"
      ;;
    prune)
      if [[ $# -eq 1 ]]; then
        cmd_prune 5
      elif [[ $# -eq 2 ]]; then
        cmd_prune "$2"
      else
        usage
      fi
      ;;
    *)
      usage
      ;;
  esac
}

main "$@"
