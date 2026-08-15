# Phase 8 — Registration Review

## Registration Summary (`GET /portal/groups/:id/registration-summary`)

- Aggregated Director-safe summary for the Review page.
- **Conflict counts** are derived from `conflictService.getGroupConflicts()` via `directorConflictDto.getDirectorConflictCounts()` — never hard-coded zeros.
- Conflict visibility follows the Phase 5.1 Director-safe policy (names for actionable display; no DOB, email, phone, or other-group roster rows).
- Module statuses (roster, performance, costume, documents) are derived from current database state.
- **No global Final Submit** — module-level submissions only (`group_registration_submissions`).
- **No generic registration state machine** — each module tracks its own submission and deadlines.

## Primary Director Fallback Order

1. `group_directors` row with `is_primary = 1`
2. `users` record via `groups.owner_director_user_id` (authoritative profile data)
3. Legacy `groups.director` text (no structured user relationship)
4. JWT display name (last resort when DB has no profile fields)

## E2E Document Test Isolation

`documents.spec.ts` no longer uses file-level `describe.serial`. The Signed Roster lifecycle test uses dedicated fixture group `E2E Document Lifecycle` and resets documents via `scripts/e2e-reset-group-documents.js` before each run so verified-lock state does not leak across runs.

## Full Registration Journey Fixtures

- `E2E Registration Journey Dance` — isolated Dance cross-module journey
- `E2E Registration Journey Choral` — isolated Choral journey (no costume module)
