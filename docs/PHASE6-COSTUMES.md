# Phase 6 — Director Costume Registration

## Scope

Costume Registration applies to **Dance groups only**. Choral groups do not show Costumes navigation and backend rejects costume API mutations.

## Data Model

Single source of truth — no portal-specific tables:

- `performance_costumes` — one row per performance + gender (MEN/WOMEN)
- `costume_conflicts` — manually entered sharing conflicts
- `costume_resource_types` — BORROWED, RENTED, MADE, PURCHASED

Four logical costume records per Dance group:

| Round | Gender |
|-------|--------|
| Semi-Final | Men's |
| Semi-Final | Women's |
| Final | Men's |
| Final | Women's |

## Costume Fields

- Region (free text)
- Village (free text, nullable)
- Resources used in creating this costume (single select from catalog)
- Has this costume ever won an award? (Yes/No)
- Did you purchase most or all of the costume? (Yes/No)
- Did you purchase any parts of the costume? (Yes/No)

## Manual Costume Conflict (ONLY manual conflict type)

Directors may manually enter **costume sharing conflicts** only. Dancer, Director, and Musician conflicts remain automatic.

Fields:

- Round (Semi-Final / Final)
- Related Group (same event; parish derived from related group)
- Number of Costumes Shared (positive integer)

## Submission & Deadline

- `submission_type`: `COSTUME`
- Saving costume data ≠ submitting
- `submitted_at` does **not** lock editing — deadline controls mutability
- Costume deadline uses standard `event_registration_deadlines` with type `COSTUME`
- Historical events: read-only regardless of deadline

## Portal Navigation

**Dance:** Overview → Roster → Performance → **Costumes**

**Choral:** Overview → Roster → Performance (no Costumes)

Route: `/groups/:id/costumes`

## Backend Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /portal/groups/:id/costume-context` | Deadline, submission, performances |
| `GET /portal/groups/:id/related-groups` | Director-safe conflict group search |
| `GET /groups/:id/costume-resource-types` | Resource catalog |
| `GET/POST/PUT /groups/:id/performances/:perfId/costumes` | Costume CRUD |
| `GET/POST/PUT/DELETE /groups/:id/costume-conflicts` | Manual conflicts |
| `POST /groups/:id/submissions` (`COSTUME`) | Mark submitted |

## Security

- Dance-only enforcement server-side
- IDOR protection via group ownership
- Performance ownership validated before costume mutations
- `checkRegistrationEditAllowed` for COSTUME on all mutations
- Related-group selector returns minimal metadata only
