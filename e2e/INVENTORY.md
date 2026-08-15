# FDF Portal — E2E Test Inventory (Phase 5)

## Performance Registration

| Scenario | Spec file | Status |
|----------|-----------|--------|
| Dance Semi-Final / Final navigation | `performance.spec.ts` | Covered |
| Dance entry CRUD | `performance.spec.ts` | Covered |
| Dance entry reorder (UI + API) | `performance.spec.ts` | Covered |
| Dance submission + post-submit edit | `performance.spec.ts` | Covered |
| Dance AV persistence | `performance.spec.ts` | Covered |
| Musician search/select | `performance.spec.ts` | Covered |
| 8-musician limit (API) | `performance.spec.ts` | Covered |
| Scored entry delete protection | `performance.spec.ts` | Covered |
| Performance deadline (API) | `performance.spec.ts` | Covered |
| Historical read-only | `performance.spec.ts` | Covered |
| Performance IDOR (group level) | `performance.spec.ts` | Covered |
| Choral rounds + field absence | `performance-choral.spec.ts` | Covered |
| Choral song create/read/reload | `performance-choral.spec.ts` | Covered |
| Choral song edit (SECULAR/LITURGICAL) | `performance-choral.spec.ts` | Covered |
| Choral song delete | `performance-choral.spec.ts` | Covered |
| Choral reorder (UI + API) | `performance-choral.spec.ts` | Covered |
| Choral mobile Move Down | `performance-choral.spec.ts` | Covered |
| Choral submission + post-submit edit | `performance-choral.spec.ts` | Covered |
| Choral deadline (API) | `performance-choral.spec.ts` | Covered |
| Instrument select/remove/persist | `performance-instruments.spec.ts` | Covered |
| Instrument round isolation | `performance-instruments.spec.ts` | Covered |
| Instrument Other + custom text | `performance-instruments.spec.ts` | Covered |
| Other validation (empty custom) | `performance-instruments.spec.ts` | Covered |
| Stored XSS string (plain text) | `performance-instruments.spec.ts` | Covered |
| Musician conflict Portal warning | `performance-conflicts.spec.ts` | Covered |
| Musician conflict DTO privacy | `performance-conflicts.spec.ts` | Covered |
| Different-round no conflict | `performance-conflicts.spec.ts` | Covered |
| Mass assignment (entries, logistics, submission) | `performance-security.spec.ts` | Covered |
| Group type submission mismatch | `performance-security.spec.ts` | Covered |
| Nested IDOR (entry, musician, instrument) | `performance-security.spec.ts` | Covered |
| Director-safe DTO (no division/scores) | `performance-security.spec.ts` | Covered |
| Cross-portal shared data | Admin `performance-cross-portal.spec.ts` | Covered |

## Backend Unit Tests

| Area | File |
|------|------|
| Group type mapping, validation, reorder | `registration.performanceService.test.js` |
| Mass assignment DTO whitelist | `registration.performanceMassAssignment.test.js` |

## Browser Matrix

| Project | Performance specs included |
|---------|---------------------------|
| `portal-chromium` | All `performance*.spec.ts` |
| `portal-mobile` | All `performance*.spec.ts` |
| `portal-webkit` | All `performance*.spec.ts` |
