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
