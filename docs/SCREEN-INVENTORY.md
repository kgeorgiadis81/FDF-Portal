# FDF Portal — Screen Inventory (Phase 5 additions)

## Performance Registration

| Property | Value |
|----------|-------|
| **Route** | `/groups/:id/performance` |
| **Group types** | `DANCE`, `CHORAL` |
| **Rounds** | Semi-Final, Final (Material tabs) |
| **Allowed role** | Director (group owner) |
| **PII classification** | Low — group/event names; musician display names with disambiguation hints only |
| **Backend endpoints** | See `docs/PHASE5-PERFORMANCE.md` |
| **Mutation permissions** | Owner Director only; server-side `canAccessGroupPII` + deadline check |
| **Deadline behavior** | `can_edit` from `performance-context`; read-only banner when false |
| **Historical behavior** | Read-only for inactive events |
| **Playwright specs** | `performance.spec.ts`, `performance-choral.spec.ts`, `performance-instruments.spec.ts`, `performance-conflicts.spec.ts`, `performance-security.spec.ts` |

### Sub-areas

| Section | Dance | Choral |
|---------|-------|--------|
| Entry list | Dances | Songs |
| Musicians / Instruments | Yes | Hidden |
| AV / logistics | Full + FDF tables/chairs | Music/AV textareas only |
| Conflict warnings | Musician, dancer, director | Same (when applicable) |
| Submission CTA | `Submit Performance Information` | Same |

### Dialogs

| Dialog | Route context | Spec coverage |
|--------|---------------|---------------|
| Add/Edit Dance or Song | Entry CRUD | `performance.spec.ts`, `performance-choral.spec.ts` |
| Delete confirmation | Entry delete | `performance-choral.spec.ts` |
| Submit confirmation | Submission | `performance.spec.ts`, `performance-choral.spec.ts` |
| Other instrument prompt | Instrument Other | `performance-instruments.spec.ts` |
