#!/usr/bin/env bash
# Shared SSH options for the Director Portal deploy.
# Trust only the known_hosts file written from the VPS_KNOWN_HOSTS secret.
# shellcheck shell=bash

# Build the OpenSSH flags used for every portal deploy connection.
# GlobalKnownHostsFile is /dev/null so a runner image cannot add trust.
portal_ssh_base() {
  PORTAL_SSH_ARGS=(
    -o BatchMode=yes
    -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=${HOME}/.ssh/known_hosts"
    -o GlobalKnownHostsFile=/dev/null
    -o IdentitiesOnly=yes
    -o "IdentityFile=${HOME}/.ssh/id_ed25519"
    -o UpdateHostKeys=no
    -o PreferredAuthentications=publickey
    -o ConnectTimeout=20
    -o LogLevel=ERROR
  )
}

# Run ssh with the pinned host key and the deploy identity.
portal_ssh() {
  portal_ssh_base
  command ssh "${PORTAL_SSH_ARGS[@]}" "$@"
}

# Single string for `rsync -e`. Paths are shell-quoted.
portal_ssh_rsh() {
  portal_ssh_base
  local arg
  printf 'ssh'
  for arg in "${PORTAL_SSH_ARGS[@]}"; do
    printf ' %q' "$arg"
  done
}

# Write the deploy key and the pinned host key. Never prints either value.
# VPS_KNOWN_HOSTS must be one or more OpenSSH known_hosts lines, not a
# bare SHA256 fingerprint.
portal_install_ssh_files() {
  if [[ -z "${VPS_SSH_KEY:-}" || -z "${VPS_KNOWN_HOSTS:-}" ]]; then
    echo "::error::VPS_SSH_KEY and VPS_KNOWN_HOSTS are required." >&2
    exit 1
  fi
  mkdir -p "${HOME}/.ssh"
  chmod 700 "${HOME}/.ssh"
  printf '%s\n' "$VPS_SSH_KEY" | tr -d '\r' > "${HOME}/.ssh/id_ed25519"
  chmod 600 "${HOME}/.ssh/id_ed25519"
  printf '%s\n' "$VPS_KNOWN_HOSTS" | tr -d '\r' > "${HOME}/.ssh/known_hosts"
  chmod 600 "${HOME}/.ssh/known_hosts"
  if ! grep -Eq '(^| )(ssh-ed25519|ssh-rsa|ecdsa-sha2-) ' "${HOME}/.ssh/known_hosts"; then
    echo "::error::VPS_KNOWN_HOSTS must be one or more OpenSSH known_hosts lines. A bare SHA256 fingerprint is not enough, and the value was not printed." >&2
    exit 1
  fi
}
