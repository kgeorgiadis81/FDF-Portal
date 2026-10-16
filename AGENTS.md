# FDF Portal — Agent Instructions

## Repository Overview

This is the **FDF Portal** — the Director-facing registration and group management portal for FDF competitions.

| Property | Value |
|----------|-------|
| GitHub | `kgeorgiadis81/FDF-Portal` |
| Tech | Angular 22, Angular Material 22, TypeScript 6 |
| Backend | `kgeorgiadis81/FDF_Backend` (separate repo) |
| Admin Portal | `kgeorgiadis81/FDF-Admin-Portal` (separate repo — internal admin) |

**Package manager**: npm  
**Node version**: 24 LTS (v24.18.0)  
**Angular version**: 22.x (standalone components, Signals-first, `ChangeDetectionStrategy.Eager`)  
**TypeScript**: 6.0.x (required by Angular 22)

---

## User Role

- **Director** — registers groups, manages rosters and chaperones, signs consent forms
- Authentication: Google Sign-In (OAuth/OIDC) or email/password
- Authorization: group ownership enforced server-side; Directors can only access their own groups

---

## Mandatory Toolchain

### Angular Development
Use the official Angular developer skill whenever creating or editing Angular components,
services, routing, forms, signals, or tests:

```
.agents/skills/angular-developer/SKILL.md
```

### UI Creation (designing or substantially redesigning)
Read and follow before creating new interfaces:
```
.agents/skills/frontend-design/SKILL.md
```

### UI Review (validating existing or modified UI quality)
Read and follow to review UI:
```
.agents/skills/frontend-design-review/SKILL.md
```

### Browser / E2E Testing
For writing Playwright tests, debugging failures, and CI integration:
```
.agents/skills/playwright-dev/SKILL.md
.agents/skills/playwright-test-results/SKILL.md
.agents/skills/playwright-triage/SKILL.md
.agents/skills/playwright-devops/SKILL.md
```

### Security (OWASP)
For any security-sensitive code (auth, authz, PII, SQL, APIs, uploads, secrets):
```
.agents/skills/owasp-security/SKILL.md
```
Which references the vendored OWASP procedures in:
```
tooling/owasp-security-playbook/code-security-skills/
```

---

## Linear issues

When the user asks you to work on a Linear issue (for example, “implement INT-59”):

1. **Fetch the issue first** (Linear MCP `get_issue`) and follow its description, acceptance criteria, and any repo-specific warnings.
2. **Keep the issue current** throughout the work:
   - **In Progress** when you start implementation.
   - **In Review** while the PR is under review (open and not yet merged).
   - **Done** only after the PR is merged to the target branch (or the user explicitly confirms merge without a PR).
3. **Link the PR** on the issue (`links` on `save_issue`) and **append a short agent update** to the description (what changed, how it was verified, merge status). Do not leave stale “not merged” notes after the user merges.
4. Respect issue instructions that override defaults (for example, “do not merge” or “do not deploy”).

---

## MCP Servers

Configured in `.cursor/mcp.json`:
- **angular-cli** — Angular CLI MCP server (`@angular/cli mcp`)
- **playwright** — Playwright MCP server (`@playwright/mcp@latest`)

---

## Cursor Rules

All rules in `.cursor/rules/`:

| Rule | Scope | Purpose |
|------|-------|---------|
| `fdf-security.mdc` | **Always applied** | Mandatory security standards; OWASP procedures |
| `fdf-angular-development.mdc` | Angular source files | Angular 22 patterns, UI completion gate |
| `fdf-ui-ux-quality.mdc` | Angular HTML/TS/SCSS | UX principles, mobile-first standards, UI completion gate |
| `fdf-e2e-testing.mdc` | Angular + E2E files | Playwright coverage requirement, portal completion gate |

---

## Testing

### Frontend Unit Tests
```bash
ng test  # Karma/Jasmine
```

### E2E Tests (Playwright)
```bash
# First-time setup (requires FDF_Backend e2e environment running):
cp e2e/.env.test.example e2e/.env.test
npx playwright install chromium

# Run tests:
npm run e2e              # Portal tests on Chromium desktop
npm run e2e:mobile       # Portal mobile tests
npm run e2e:all          # All portal browser projects
```

See `e2e/README.md` for full prerequisites. Uses dedicated `FDF_DB_E2E` database on port 3307. Portal runs on port 4201. **Never run against production.**

---

## All UI Behavior Changes

Any change to a user-visible action or workflow **requires** a corresponding Playwright E2E test update.
A feature is not complete if user-visible behavior changed but E2E coverage was not updated.

## All Security/PII/Auth Changes

Any change touching authentication, authorization, PII, SQL, APIs, uploads, or secrets requires:
1. Mandatory security review using OWASP procedures
2. `npm audit` run and findings documented
3. Security completion gate checklist passed (see `fdf-security.mdc`)

---

## Architecture Notes

- **Google Sign-In** — OAuth/OIDC via Google; JWT issued by backend after verification
- **JWT auth_version** — `auth_version` column on `users` table; incremented on credential changes; old sessions rejected
- **Group ownership** — Directors own groups; all group/roster/chaperone operations validated server-side against ownership
- **Angular Material 22** — UI component library; follow existing patterns
- **Mobile-first** — Portal is Director-facing; mobile usability is critical
- **ExcelJS** — Excel import/export for roster data

---

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Tooling, skills, Playwright, security, rules |
| Phase 1 | ✅ Complete | FDF Portal database and registration schema |
| Phase 3 | ✅ Complete | FDF Portal — Director auth, groups, Google Sign-In |
| Phase 3.5 | ✅ Complete | Framework & dependency modernization (Angular 22, Express 5, JWT hardening) |
| Phase 4 | ✅ Complete | Director Roster & Chaperones |

---

## Cursor Cloud specific instructions

Repo-managed environment: `.cursor/environment.json`.

- `install` (`.cursor/install.sh`) installs Node 24, Docker, Playwright Chromium with system dependencies, Chrome for Karma, and clones `kgeorgiadis81/FDF_Backend` as a sibling (`../FDF_Backend`). It copies `e2e/.env.test.example` to `e2e/.env.test` and the backend `.env.e2e.example` to `.env.e2e`. Those copies stay untracked.
- `start` (`.cursor/start.sh`) starts dockerd, the `fdf-mariadb-e2e` container on port 3307, and `npm run e2e:setup` in FDF_Backend. It writes `/tmp/fdf-e2e-ready` only after the seed succeeds.
- Terminal `api-e2e` waits for that file, then runs FDF_Backend `npm run start:e2e` (http://localhost:3501/health).
- Terminal `portal-e2e` runs this repo's `npm run start:e2e` on port 4201. That port is also what `npm start` uses, so the dev server (API at `:3500`) is not started on boot.

### Node version

The Angular 22 CLI hard-blocks Node `< v22.22.3` / `< v24.15`. The VM default `node` (`/exec-daemon/node`) can be older and shadows nvm. `.cursor/install.sh` installs Node 24 via nvm and puts it on `PATH` for login shells (`~/.bashrc` and `/etc/profile.d/fdf-node.sh`). If `ng` fails on Node version, use a login shell: `bash -lc '…'`.

### Running the Portal

- Dev server: `npm start` → `http://localhost:4201` (dev API `:3500`). Stop `portal-e2e` first; both bind 4201.
- E2E serve: `npm run start:e2e` → `:4201` against backend `:3501`.
- Unit tests (headless, single run): `npx ng test --watch=false --browsers=ChromeHeadless`. `npm test` is watch mode. ChromeHeadless runs without a no-sandbox wrapper on the Cloud Agent image.

Playwright e2e expects the sibling backend, MariaDB, and the seed that `start.sh` already runs. Seeded director accounts are in `e2e/.env.test.example`. Never run e2e against production.
