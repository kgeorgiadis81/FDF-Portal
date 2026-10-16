#!/usr/bin/env bash
# Local checks for versioned portal releases, smoke, and pinned host keys.
# Does not contact production.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_eq() {
  local got=$1 expected=$2 label=$3
  if [[ "$got" != "$expected" ]]; then
    fail "${label}: expected [${expected}] got [${got}]"
  fi
}

sha_n() {
  printf '%040x' "$1"
}

make_release() {
  local root=$1 sha=$2 asset=${3:-main-ABCDEFGH.js}
  local dir="${root}/releases/${sha}"
  mkdir -p "$dir"
  printf '<!doctype html><script src="%s"></script>\n' "$asset" > "${dir}/index.html"
  printf '{"app":"fdf-portal","commit":"%s","asset":"%s"}\n' "$sha" "$asset" > "${dir}/version.json"
}

stamp() {
  local dir=$1 when=$2
  touch -d "$when" "$dir"
}

current_target() {
  if [[ -L "$1/current" ]]; then
    readlink -f "$1/current"
  else
    echo "missing"
  fi
}

release() {
  PORTAL_ROOT=$1 bash "$ROOT/scripts/portal-release.sh" "${@:2}"
}

echo "== release activate, rollback, prune =="
work=$(mktemp -d)
trap 'rm -rf "$work"; [[ -n "${SSHD_PID:-}" ]] && kill "$SSHD_PID" 2>/dev/null || true; [[ -n "${SMOKE_PID:-}" ]] && kill "$SMOKE_PID" 2>/dev/null || true' EXIT

old=$(sha_n 1)
new=$(sha_n 2)
make_release "$work" "$old"
stamp "$work/releases/$old" '2026-01-01 00:00:01'
ln -s "$work/releases/$old" "$work/current"

make_release "$work" "$new"
stamp "$work/releases/$new" '2026-01-02 00:00:01'
prev=$(release "$work" activate "$new")
assert_eq "$prev" "FDF_PREVIOUS ${work}/releases/${old}" "activate stdout"
assert_eq "$(current_target "$work")" "$work/releases/$new" "current after good activate"
[[ -d "$work/releases/$old" ]] || fail "previous release was removed during activate"

# Failed smoke: switch current back. The new folder stays on disk.
release "$work" rollback "$work/releases/$old" >/dev/null
assert_eq "$(current_target "$work")" "$work/releases/$old" "current after rollback"
[[ -d "$work/releases/$new" ]] || fail "failed release folder should remain for inspection"

# Activate refuses a tree without the marker and does not move current.
bad=$(sha_n 3)
mkdir -p "$work/releases/$bad"
printf '<!doctype html>\n' > "$work/releases/$bad/index.html"
if release "$work" activate "$bad" >/dev/null 2>"$work/bad.err"; then
  fail "activate should reject a release with no version.json"
fi
assert_eq "$(current_target "$work")" "$work/releases/$old" "current unchanged after rejected activate"
grep -q 'current was not changed' "$work/bad.err"

# Commit inside version.json must match the directory name.
mismatch=$(sha_n 4)
make_release "$work" "$mismatch"
printf '{"app":"fdf-portal","commit":"%s","asset":"main-ABCDEFGH.js"}\n' "$old" > "$work/releases/$mismatch/version.json"
if release "$work" activate "$mismatch" >/dev/null 2>"$work/mismatch.err"; then
  fail "activate should reject a mismatched version.json commit"
fi
assert_eq "$(current_target "$work")" "$work/releases/$old" "current unchanged after commit mismatch"

# Path traversal and targets outside releases/.
if release "$work" activate '../etc' >/dev/null 2>&1; then
  fail "activate should reject a non-sha id"
fi
if release "$work" rollback '/tmp/not-a-release' >/dev/null 2>&1; then
  fail "rollback should reject a path outside releases"
fi
assert_eq "$(current_target "$work")" "$work/releases/$old" "current unchanged after rejected rollback"
if release "$work" rollback "${work}/releases/${old}/../../etc" >/dev/null 2>&1; then
  fail "rollback should reject .. in the target"
fi

# A real directory named current is not replaced.
plain=$(mktemp -d)
mkdir -p "$plain/current"
if PORTAL_ROOT=$plain bash "$ROOT/scripts/portal-release.sh" activate "$old" >/dev/null 2>&1; then
  fail "activate should refuse when current is not a symlink"
fi
[[ -d "$plain/current" && ! -L "$plain/current" ]] || fail "non-symlink current was replaced"
rm -rf "$plain"

# First release: previous is none. Rollback removes the symlink.
first=$(mktemp -d)
make_release "$first" "$old"
prev=$(release "$first" activate "$old")
assert_eq "$prev" "FDF_PREVIOUS none" "first activate previous"
release "$first" rollback none >/dev/null
[[ -L "$first/current" ]] && fail "rollback none should remove current"
[[ -d "$first/releases/$old" ]] || fail "release folder removed with the symlink"
rm -rf "$first"

# Prune keeps 5 newest, and still keeps an older live release.
prune_root=$(mktemp -d)
mkdir -p "$prune_root/releases"
live=""
for i in 1 2 3 4 5 6 7; do
  id=$(sha_n "$i")
  make_release "$prune_root" "$id"
  stamp "$prune_root/releases/$id" "2026-02-0${i} 00:00:00"
  if [[ "$i" -eq 1 ]]; then
    live=$id
  fi
done
ln -s "$prune_root/releases/$live" "$prune_root/current"
mkdir -p "$prune_root/releases/not-a-commit"
release "$prune_root" prune 5 >/dev/null
[[ -d "$prune_root/releases/$live" ]] || fail "prune deleted the live release"
[[ -d "$prune_root/releases/not-a-commit" ]] || fail "prune deleted a non-commit directory"
kept=0
for dir in "$prune_root/releases"/*; do
  base=$(basename "$dir")
  if [[ "$base" =~ ^[0-9a-f]{40}$ ]]; then
    kept=$((kept + 1))
  fi
done
# Newest five (3..7) plus the older live release (1). Release 2 is the one dropped.
assert_eq "$kept" "6" "prune keep count"
[[ ! -d "$prune_root/releases/$(sha_n 2)" ]] || fail "expected the unpinned older release to be pruned"
rm -rf "$prune_root"

echo "== release marker =="
marker=$(mktemp -d)
mkdir -p "$marker"
cat > "$marker/index.html" <<'EOF'
<!doctype html>
<html><body>
<script src="polyfills-5CFQRCPP.js" type="module"></script>
<script src="main-VKSL6X7H.js" type="module"></script>
<script src="https://accounts.google.com/gsi/client" async></script>
</body></html>
EOF
commit=$(sha_n 9)
RELEASE_DIST=$marker RELEASE_COMMIT=$commit node "$ROOT/scripts/write-release-marker.js" >/dev/null
assert_eq "$(jq -r .commit "$marker/version.json")" "$commit" "marker commit"
assert_eq "$(jq -r .asset "$marker/version.json")" "main-VKSL6X7H.js" "marker prefers main bundle"
if RELEASE_DIST=$marker RELEASE_COMMIT='not-a-sha' node "$ROOT/scripts/write-release-marker.js" >/dev/null 2>&1; then
  fail "marker should reject a bad commit"
fi
printf '<script src="../main-VKSL6X7H.js"></script>\n' > "$marker/index.html"
if RELEASE_DIST=$marker RELEASE_COMMIT=$commit node "$ROOT/scripts/write-release-marker.js" >/dev/null 2>&1; then
  fail "marker should reject a path-like asset"
fi
rm -rf "$marker"

echo "== smoke check =="
smoke_commit=$(sha_n 8)
asset='main-ABCDEFGH.js'
local_json=$(mktemp)
printf '{"app":"fdf-portal","commit":"%s","asset":"%s"}\n' "$smoke_commit" "$asset" > "$local_json"
cat > "$work/smoke_server.py" <<'PY'
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

mode, port, commit, asset = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _send(self, body, content_type):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/version.json":
            if mode == "html-version":
                self._send("<!doctype html><html></html>", "text/html")
                return
            seen = "0" * 40 if mode == "wrong-commit" else commit
            self._send(json.dumps({"app": "fdf-portal", "commit": seen, "asset": asset}), "application/json")
            return
        if path == "/":
            self._send(f'<!doctype html><script src="{asset}"></script>', "text/html")
            return
        if path == "/" + asset:
            if mode == "html-asset":
                self._send("<!doctype html><html><body>fallback</body></html>", "text/html")
                return
            self._send('console.log("portal");\n', "text/javascript; charset=utf-8")
            return
        self.send_response(404)
        self.end_headers()

ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
PY

port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
start_smoke() {
  local mode=$1
  if [[ -n "${SMOKE_PID:-}" ]]; then
    kill "$SMOKE_PID" 2>/dev/null || true
    wait "$SMOKE_PID" 2>/dev/null || true
  fi
  python3 "$work/smoke_server.py" "$mode" "$port" "$smoke_commit" "$asset" &
  SMOKE_PID=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -o /dev/null "http://127.0.0.1:${port}/version.json" 2>/dev/null; then
      return 0
    fi
    sleep 0.1
  done
  fail "smoke test server did not start"
}

export SMOKE_ALLOW_INSECURE=1
start_smoke good
bash "$ROOT/scripts/smoke-portal-release.sh" "http://127.0.0.1:${port}" "$smoke_commit" "$local_json" >/dev/null

start_smoke wrong-commit
if bash "$ROOT/scripts/smoke-portal-release.sh" "http://127.0.0.1:${port}" "$smoke_commit" "$local_json" >/dev/null 2>"$work/smoke-wrong.err"; then
  fail "smoke should fail when the live commit differs"
fi
grep -q 'does not match' "$work/smoke-wrong.err"

start_smoke html-asset
if bash "$ROOT/scripts/smoke-portal-release.sh" "http://127.0.0.1:${port}" "$smoke_commit" "$local_json" >/dev/null 2>"$work/smoke-html.err"; then
  fail "smoke should fail when the hashed asset is HTML"
fi
grep -q 'HTML\|not JavaScript' "$work/smoke-html.err"

start_smoke html-version
if bash "$ROOT/scripts/smoke-portal-release.sh" "http://127.0.0.1:${port}" "$smoke_commit" "$local_json" >/dev/null 2>"$work/smoke-ver.err"; then
  fail "smoke should fail when version.json is HTML"
fi
kill "$SMOKE_PID" 2>/dev/null || true
wait "$SMOKE_PID" 2>/dev/null || true
unset SMOKE_PID

if SMOKE_ALLOW_INSECURE= bash "$ROOT/scripts/smoke-portal-release.sh" "http://127.0.0.1:${port}" "$smoke_commit" "$local_json" >/dev/null 2>&1; then
  fail "smoke should reject http unless the local test override is set"
fi

echo "== pinned host key =="
if [[ ! -x /usr/sbin/sshd ]]; then
  fail "OpenSSH server is required for the host-key test"
fi

ssh_home=$(mktemp -d)
ssh-keygen -t ed25519 -f "$ssh_home/host_key" -N '' -q
ssh-keygen -t ed25519 -f "$ssh_home/client_key" -N '' -q
ssh-keygen -t ed25519 -f "$ssh_home/wrong_key" -N '' -q
cp "$ssh_home/client_key.pub" "$ssh_home/authorized_keys"
chmod 600 "$ssh_home/authorized_keys"
ssh_port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
cat > "$ssh_home/sshd_config" <<EOF
Port ${ssh_port}
ListenAddress 127.0.0.1
HostKey ${ssh_home}/host_key
PidFile ${ssh_home}/sshd.pid
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile ${ssh_home}/authorized_keys
UsePAM no
StrictModes no
PrintMotd no
PrintLastLog no
AllowUsers $(whoami)
Subsystem sftp internal-sftp
EOF
/usr/sbin/sshd -f "$ssh_home/sshd_config" -D -e >"$ssh_home/sshd.log" 2>&1 &
SSHD_PID=$!
host_pub=$(awk '{print $1" "$2}' "$ssh_home/host_key.pub")
wrong_pub=$(awk '{print $1" "$2}' "$ssh_home/wrong_key.pub")
printf '[127.0.0.1]:%s %s\n' "$ssh_port" "$wrong_pub" > "$ssh_home/bad_hosts"
printf '[127.0.0.1]:%s %s\n' "$ssh_port" "$host_pub" > "$ssh_home/good_hosts"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if grep -q 'Server listening' "$ssh_home/sshd.log" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$SSHD_PID" 2>/dev/null; then
    cat "$ssh_home/sshd.log" >&2 || true
    fail "sshd exited during startup"
  fi
  sleep 0.1
done

# shellcheck source=scripts/portal-ssh.sh
source "$ROOT/scripts/portal-ssh.sh"
export HOME="$ssh_home"
sentinel="$ssh_home/uploaded"
export VPS_SSH_KEY
VPS_SSH_KEY=$(cat "$ssh_home/client_key")
export VPS_KNOWN_HOSTS
VPS_KNOWN_HOSTS=$(cat "$ssh_home/bad_hosts")
portal_install_ssh_files
set +e
portal_ssh -p "$ssh_port" "$(whoami)@127.0.0.1" "touch ${sentinel}" >"$ssh_home/bad.out" 2>"$ssh_home/bad.err"
bad_rc=$?
set -e
[[ "$bad_rc" -ne 0 ]] || fail "wrong host key should fail SSH"
[[ ! -e "$sentinel" ]] || fail "wrong host key uploaded or ran a remote command"
if ! grep -Eq 'Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED' "$ssh_home/bad.err"; then
  cat "$ssh_home/bad.err" >&2
  fail "wrong host key did not fail the host-key check"
fi
if grep -q 'Permission denied' "$ssh_home/bad.err"; then
  fail "wrong host key reached authentication"
fi

VPS_KNOWN_HOSTS=$(cat "$ssh_home/good_hosts")
portal_install_ssh_files
portal_ssh -p "$ssh_port" "$(whoami)@127.0.0.1" "touch ${sentinel}"
[[ -e "$sentinel" ]] || fail "matching host key should allow the remote command"

# The workflow pipes portal-release.sh over SSH. Exercise that path locally.
remote_root="$ssh_home/portal"
remote_old=$(sha_n 11)
remote_new=$(sha_n 12)
make_release "$remote_root" "$remote_old"
ln -s "$remote_root/releases/$remote_old" "$remote_root/current"
make_release "$remote_root" "$remote_new"
raw=$(portal_ssh -p "$ssh_port" "$(whoami)@127.0.0.1" \
  "PORTAL_ROOT=${remote_root} bash -s -- activate ${remote_new}" \
  < "$ROOT/scripts/portal-release.sh")
assert_eq "$raw" "FDF_PREVIOUS ${remote_root}/releases/${remote_old}" "activate over ssh"
assert_eq "$(readlink -f "$remote_root/current")" "$remote_root/releases/$remote_new" "current after ssh activate"
[[ -d "$remote_root/releases/$remote_old" ]] || fail "previous release removed by ssh activate"
portal_ssh -p "$ssh_port" "$(whoami)@127.0.0.1" \
  "PORTAL_ROOT=${remote_root} bash -s -- rollback ${remote_root}/releases/${remote_old}" \
  < "$ROOT/scripts/portal-release.sh" >/dev/null
assert_eq "$(readlink -f "$remote_root/current")" "$remote_root/releases/$remote_old" "current after ssh rollback"

# A wrong pinned key must fail before rsync creates anything.
VPS_KNOWN_HOSTS=$(cat "$ssh_home/bad_hosts")
portal_install_ssh_files
mkdir -p "$ssh_home/payload"
echo bundle > "$ssh_home/payload/index.html"
no_upload="$ssh_home/no-upload"
rm -rf "$no_upload"
set +e
rsync -az --delete -e "$(portal_ssh_rsh) -p ${ssh_port}" \
  "$ssh_home/payload/" "$(whoami)@127.0.0.1:${no_upload}/" \
  >"$ssh_home/rsync.out" 2>"$ssh_home/rsync.err"
rsync_rc=$?
set -e
[[ "$rsync_rc" -ne 0 ]] || fail "rsync should fail when the pinned host key is wrong"
[[ ! -e "$no_upload" ]] || fail "rsync created a destination despite a wrong host key"
if ! grep -Eq 'Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED' "$ssh_home/rsync.err"; then
  cat "$ssh_home/rsync.err" >&2
  fail "rsync did not fail on the host key"
fi

# A bare fingerprint never reaches SSH.
VPS_KNOWN_HOSTS='SHA256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
set +e
install_out=$(portal_install_ssh_files 2>&1)
install_rc=$?
set -e
[[ "$install_rc" -ne 0 ]] || fail "bare fingerprint should be rejected"
if printf '%s' "$install_out" | grep -q 'SHA256:aaa'; then
  fail "fingerprint secret was printed"
fi
if printf '%s' "$install_out" | grep -q 'OPENSSH PRIVATE KEY'; then
  fail "private key was printed"
fi
rsh=$(portal_ssh_rsh)
printf '%s' "$rsh" | grep -q 'StrictHostKeyChecking=yes' || fail "rsync ssh command is not strict"
printf '%s' "$rsh" | grep -q 'GlobalKnownHostsFile=/dev/null' || fail "rsync ssh command trusts the system known_hosts"

echo "== workflow wiring =="
if grep -R -n 'ssh-keyscan' .github/workflows; then
  fail "ssh-keyscan is still in a workflow"
fi
verify_line=$(grep -n 'name: Verify pinned host key' .github/workflows/deploy.yml | head -n 1 | cut -d: -f1)
rsync_line=$(grep -n 'name: Rsync the release' .github/workflows/deploy.yml | head -n 1 | cut -d: -f1)
rollback_line=$(grep -n 'name: Roll back current after a failed smoke check' .github/workflows/deploy.yml | head -n 1 | cut -d: -f1)
smoke_line=$(grep -n 'name: Smoke check release marker' .github/workflows/deploy.yml | head -n 1 | cut -d: -f1)
[[ -n "$verify_line" && -n "$rsync_line" && "$verify_line" -lt "$rsync_line" ]] || fail "host-key check must run before rsync"
[[ -n "$smoke_line" && -n "$rollback_line" && "$smoke_line" -lt "$rollback_line" ]] || fail "rollback must follow the smoke step"
grep -q 'steps.smoke.outcome == '"'"'failure'"'"'' .github/workflows/deploy.yml || fail "rollback is not tied to smoke failure"
grep -q 'VPS_KNOWN_HOSTS' .github/workflows/deploy.yml || fail "workflow does not require VPS_KNOWN_HOSTS"
grep -q '/var/www/fdf/portal/releases/' .github/workflows/deploy.yml || fail "rsync target is not a release folder"
grep -q 'bash scripts/smoke-portal-release.sh' .github/workflows/deploy.yml || fail "smoke step is missing"
grep -q 'version.json' docs/DEVOPS-PLAYBOOK.md || fail "playbook is missing the release marker"
grep -q 'root /var/www/fdf/portal/current' docs/DEVOPS-PLAYBOOK.md || fail "playbook is missing the nginx root change"

echo "All portal release checks passed."
