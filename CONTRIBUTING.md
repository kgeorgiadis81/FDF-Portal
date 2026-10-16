# Contributing to FDF Portal (Directors)

## Source control and production deploys

FDF production deploys run from GitHub Actions when `main` is updated. On GitHub Free, branch protection may be unavailable, so we rely on **process** plus workflow guards:

- **Never push directly to `main`.** That includes bots, CI, and Cursor Cloud Agents.
- **All changes land via pull request.** Open a PR against `main`; wait for the **CI** workflow to pass.
- **Only Kostas (`@kgeorgiadis81`) merges PRs to `main`.** Merging triggers CI on `main` and then the gated **Deploy** workflow.
- Agents and automation must **open PRs only** — do not merge, dispatch Deploy, or rerun production workflows unless Kostas explicitly asks.

Deploy workflows run a production build before rsync, check required secrets by name, and (on push to `main`) verify the commit is associated with a merged pull request. The deploy job uses the GitHub `production` environment (supported on this public repository).

Required deploy secrets (names only; never commit values):

- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` — SSH target and private key
- `VPS_KNOWN_HOSTS` — pinned `known_hosts` line(s) for the VPS (do not use `ssh-keyscan` at deploy time)
- `GOOGLE_CLIENT_ID` — injected at production build time

## Local development

See [README.md](README.md) for setup and tests.
