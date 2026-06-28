# Naming Convention

## Product Language

Use these terms consistently:

| Use | Avoid |
|---|---|
| Project | Event, Job |
| Mission | Task, Trip |
| Assignment | Schedule Item |
| Call Sign | Car Name, Plate |
| Driver | Chauffeur unless business requires |
| Vehicle | Car |
| Coordinator | Staff |
| Organizer | Customer Staff |
| Timeline Event | Log |
| Publish | Save Final |
| Change Request | Edit Request |
| Recovery | Fix |
| Incident | Problem |
| Readiness | Preparation Status |
| Operation Day | Day |
| Session | Segment |
| Venue | Place |
| Holding Area | Waiting Area |

## Code Naming

- Database tables: `snake_case`, plural, e.g. `projects`, `missions`.
- Database columns: `snake_case`.
- TypeScript types: `PascalCase`.
- React components: `PascalCase`.
- Functions: `camelCase`.
- Constants: `UPPER_CASE`.
- Routes: `kebab-case`.
- API resources: plural nouns.

## ID Strategy

- Primary ID: UUID.
- Business code: human-readable, separate from UUID.
- Example:
  - `id = uuid`
  - `project_code = TOMP-2026-0001`
  - `mission_code = MIS-001`
  - `call_sign = BLUE-05`

## Time Strategy

- Store timestamps in UTC.
- Display in project timezone.
- Every project must have timezone.
