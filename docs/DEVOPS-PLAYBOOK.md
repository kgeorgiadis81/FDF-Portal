# DevOps playbook — Director Portal releases

This page is the Director Portal (`kgeorgiadis81/FDF-Portal`) section of the FDF deploy playbook. The shared VPS layout still lives in `FDF_Backend` `deploy/README.md`. Nginx for `portal.yourfdf.com` also lives in that repo. This pull request does not change the VPS, dispatch Deploy, or merge.

Production static files are served from `/var/www/fdf/portal`. Each deploy uploads the bundle into a new folder under `releases/` and then moves the `current` symlink.

## Release layout

```text
/var/www/fdf/portal/
  releases/
    <40-hex-commit>/    # one Angular browser bundle, including version.json
  current -> /var/www/fdf/portal/releases/<40-hex-commit>
```

- The release folder name is the full git commit (`github.sha`).
- `current` is a symlink. The workflow replaces it by writing `current.next` and `mv -Tf`, so readers see either the old target or the new one.
- The newest **5** commit-named folders are kept. The folder `current` points at is never deleted, even when it is older than those five.
- A failed upload stays in its release folder. `current` is switched only after `index.html` and `version.json` for that commit are present.

`version.json` is written by `scripts/write-release-marker.js` and contains only the app name, the commit, and one hashed JavaScript filename from that build. It is not a secret (the commit is already public on GitHub).

## What the workflow does

1. Build the production bundle and write `version.json`.
2. Write `VPS_KNOWN_HOSTS` to `known_hosts` and connect with `StrictHostKeyChecking=yes`. `GlobalKnownHostsFile` is `/dev/null`. There is no `ssh-keyscan` in this repo's workflows.
3. If that SSH check fails, stop. Nothing has been uploaded.
4. `rsync` the bundle into `releases/<commit>/` only.
5. Point `current` at that release. Remember the previous target.
6. Smoke `https://portal.yourfdf.com`:
   - `version.json` commit and asset match this build
   - the home page references that asset
   - the asset returns JavaScript, not the SPA `index.html` fallback
7. If the smoke check fails, point `current` back at the previous release (or remove `current` when there was none) and leave the job red.
8. After a successful smoke check, prune commit-named folders outside the newest five, always keeping the live folder.

## Rollback

Automatic rollback covers the immediately previous `current` target when smoke fails. No process restart is required: nginx reads the symlink on the next request.

To roll back further, on the VPS as `fdfdeploy`, pick one of the kept folders:

```bash
readlink -f /var/www/fdf/portal/current
ls -1dt /var/www/fdf/portal/releases/*/
ln -s /var/www/fdf/portal/releases/<previous-sha> /var/www/fdf/portal/current.next
mv -Tf /var/www/fdf/portal/current.next /var/www/fdf/portal/current
curl -fsS https://portal.yourfdf.com/version.json
```

Use a real 40-character commit that is already a directory under `releases/`. Do not point `current` at a path outside that directory.

### Database and API

This deploy only replaces static files. It leaves the API process and the database on whatever `FDF_Backend` last shipped. After a portal rollback, an older bundle can be live in front of a newer API. Roll the portal back with that mismatch in mind when the UI depends on a new API. Restoring a database backup from `/var/backups/fdf` is a separate backend-playbook action and takes the API down.

## Nginx change required in FDF_Backend

Not in this repo. `fdf-reload-nginx` copies `FDF_Backend` `deploy/nginx` over `/etc/nginx` on every backend deploy, so a hand-edit on the VPS is overwritten by the next backend deploy. Land the change in `FDF_Backend` (INT-45) and reload from that copy.

Today both portal server blocks set:

```nginx
root /var/www/fdf/portal;
```

in:

- `deploy/nginx/tls/fdf-portal.conf` (this is what production uses once the certificate exists)
- `deploy/nginx/http/fdf-portal.conf` (HTTP-only fallback)

Change both to:

```nginx
root /var/www/fdf/portal/current;
```

Do that only after `current/index.html` exists. `nginx -t` then the existing reload helper (`sudo /usr/local/sbin/fdf-reload-nginx`).

Recommended in the same files, so browsers do not keep a stale shell or marker:

```nginx
location = /version.json {
    add_header Cache-Control "no-store";
}
location = /index.html {
    add_header Cache-Control "no-store";
}
```

Until `root` is `current`, nginx keeps serving files that sit directly in `/var/www/fdf/portal`, and the release folders are also reachable under `/releases/<commit>/`. After the root change, those folders are outside the document root.

## Steps Kostas must approve before this workflow runs on production

This change was not applied to the VPS. Merging to `main` starts Deploy. Approve and finish these steps first, in this order.

1. **Pin the host key in GitHub, not in git.** On the VPS, over a session you already trust (console or an existing SSH session), print the server fingerprint:

   ```bash
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
   ```

   From a trusted admin machine, obtain the matching `known_hosts` line for `VPS_HOST` and compare its fingerprint to the console output before saving it. Store that line (or the verified lines, if you pin more than ed25519) as the Actions secret `VPS_KNOWN_HOSTS` on `kgeorgiadis81/FDF-Portal`. A bare `SHA256:` fingerprint is rejected. Do not commit the value. A wrong value makes Deploy fail at SSH before rsync.

2. **Confirm `fdfdeploy` can create directories and symlinks in `/var/www/fdf/portal`.** Bootstrap already gives that user ownership (`fdfdeploy:fdf`, mode `755`). No new sudoers entry is required for the static portal deploy.

3. **Seed a baseline release without removing the files nginx still serves.** Take `<sha>` from the last successful FDF-Portal Deploy run (40 hex characters). Copy the live tree out of the document root and back in, so rsync does not recurse into its own destination. Leave the existing `index.html` in `/var/www/fdf/portal` until step 4 is live and a deploy has succeeded.

   ```bash
   sudo -u fdfdeploy mkdir -p /tmp/fdf-portal-baseline
   sudo -u fdfdeploy rsync -a \
     --exclude releases --exclude current --exclude current.next \
     /var/www/fdf/portal/ /tmp/fdf-portal-baseline/
   sudo -u fdfdeploy mkdir -p "/var/www/fdf/portal/releases/<sha>"
   sudo -u fdfdeploy rsync -a /tmp/fdf-portal-baseline/ "/var/www/fdf/portal/releases/<sha>/"
   sudo -u fdfdeploy rm -rf /tmp/fdf-portal-baseline
   test ! -e /var/www/fdf/portal/current
   sudo -u fdfdeploy ln -s "/var/www/fdf/portal/releases/<sha>" /var/www/fdf/portal/current
   test -f /var/www/fdf/portal/current/index.html
   ```

   Write `version.json` into that baseline if the old bundle does not have one, using a hashed `.js` name that exists in the copied `index.html`, so `curl https://portal.yourfdf.com/version.json` identifies the baseline after a rollback. The marker format is one line: `{"app":"fdf-portal","commit":"<sha>","asset":"<file>.js"}`.

4. **Ship the nginx `root` change from FDF_Backend** (see above) and reload nginx only after `current/index.html` exists. Do not leave a hand-edited server config that the next backend deploy will overwrite.

5. **Merge this pull request only after steps 1–4.** Without `VPS_KNOWN_HOSTS`, SSH fails closed and uploads nothing. Without the nginx root change, a successful deploy updates `current` while visitors still receive the old flat tree.

6. **After the first good versioned deploy**, delete leftover flat files that sit next to `releases/` and `current` (old `index.html` and hashed assets directly under `/var/www/fdf/portal`). Do not delete `releases/` or `current`.

## Secrets

| Secret | Role |
| --- | --- |
| `VPS_HOST` | VPS address, unchanged |
| `VPS_USER` | `fdfdeploy`, unchanged |
| `VPS_SSH_KEY` | Deploy private key, unchanged |
| `VPS_KNOWN_HOSTS` | Pinned host key, **new**. OpenSSH `known_hosts` lines only |

Workflow logs must not print `VPS_SSH_KEY` or `VPS_KNOWN_HOSTS`.
