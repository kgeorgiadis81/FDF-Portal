# Phase 5 — Director Performance Registration

## Architecture: One Source of Truth

FDF Portal does **not** store separate registration performances. Director Portal and Admin Portal both operate on the same canonical tables:

- `performances`
- `performance_entries`
- `performance_musicians`
- `performance_instruments`
- `group_registration_submissions`

No synchronization layer exists. A change made in either portal is immediately visible through the shared MariaDB schema.

## Director Dance Registration

| Area | Behavior |
|------|----------|
| Rounds | Semi-Final and Final (auto-provisioned per group) |
| Entries | Dance name, Region, Village |
| Music / singing | Live Music, Recorded Music, Acapella, Dancer(s) Singing, Musician(s) Singing, Individual Singing |
| Musicians | Search canonical musician catalog; max **8** per performance round |
| Instruments | Catalog multi-select; **Other** requires custom text |
| AV | FDF tables/chairs, Additional Props, Music/Audio Needs, Special Requirements |
| Submission | `DANCE_PERFORMANCE` sets `submitted_at`; editing remains allowed before deadline |
| Deadline | Event-timezone effective cutoff; read-only UI + API 403 after cutoff |
| Historical | Past events are read-only regardless of deadline |

## Director Choral Registration

| Area | Behavior |
|------|----------|
| Rounds | Semi-Final and Final |
| Entries | Song name, Secular/Liturgical (`SECULAR` / `LITURGICAL`), Live/Recorded Music |
| Ordering | Drag (desktop) or Move Up/Down (accessible/mobile) |
| AV | Music/Audio Needs, Other AV / Performance Information |
| Submission | `CHORAL_PERFORMANCE` |
| Deadline / historical | Same rules as Dance |

Choral UI intentionally omits dance-only fields (Region, Village, musicians, instruments, acapella/singing flags).

## Conflict Policy

| Conflict type | Director Portal | Admin Portal |
|---------------|-----------------|--------------|
| Musician same-round | Warning with musician name + other **group names** only | Full conflict service |
| Dancer same-round | Warning with participant name + other group names (no DOB) | Full conflict service |
| Director multi-group / director-dancing | Warning with group names only | Full conflict service |

Director-safe DTOs never expose: other-director email/phone, participant DOB, other-group rosters, judge data, or scores.

## Admin-Only Fields (Directors cannot mutate)

- Division, Category, classification rank, average age
- Performance time (`date_time`), group order, time penalty
- `non_scorable`, scoring, judge comments, judging locks
- `submitted_at` / `submitted_by_user_id` (server-derived on submission)
- `event_id`, `group_id`, `owner_director_user_id`

## Backend Endpoints (Director)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/portal/groups/:id/performance-context` | Deadline, submission state |
| GET | `/groups/:id/performance` | Full performance data (Director-safe DTO) |
| GET | `/groups/:id/performance/conflicts` | Director-safe conflict warnings |
| POST/PUT/DELETE | `/groups/:id/performance/:perfId/entries` | Entry CRUD |
| PATCH | `/groups/:id/performance/:perfId/entries/reorder` | Reorder (IDs preserved) |
| POST/DELETE | `/groups/:id/performance/:perfId/musicians` | Musician assign/remove (Dance only) |
| POST/DELETE | `/groups/:id/performance/:perfId/instruments` | Instrument assign/remove (Dance only) |
| PATCH | `/groups/:id/performance/:perfId/logistics` | AV fields |
| POST | `/groups/:id/submissions` | Record submission (`DANCE_PERFORMANCE` or `CHORAL_PERFORMANCE`) |

## Playwright Coverage

| Spec | Coverage |
|------|----------|
| `e2e/groups/performance.spec.ts` | Dance CRUD, submission, reorder, musicians, AV, deadline, historical |
| `e2e/groups/performance-choral.spec.ts` | Choral CRUD, reorder, submission, deadline |
| `e2e/groups/performance-instruments.spec.ts` | Instrument select/remove, Other, round isolation, XSS |
| `e2e/groups/performance-conflicts.spec.ts` | Musician conflict warnings, privacy, different-round |
| `e2e/groups/performance-security.spec.ts` | Mass assignment, nested IDOR, DTO filtering |
| Admin `e2e/registration-admin/performance-cross-portal.spec.ts` | Shared DB visibility |

## Security Notes

- All SQL parameterized; mass assignment prevented by explicit field allowlists in route handlers
- `Other` instrument `custom_name` required when `code = OTHER`; stored as plain text (Angular interpolation only)
- AV text fields validated for max length; no `innerHTML` rendering
- Performance entries with judging scores cannot be deleted (409)
