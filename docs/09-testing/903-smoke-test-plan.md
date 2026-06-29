# Smoke Test Plan

## Manual Checks

| Area | Check |
| --- | --- |
| App shell | App loads and navigation is visible |
| Projects | `/projects` renders project cards |
| Create project | `/projects/new` validates and calls server action |
| Project detail | `/projects/[projectId]` shows missions, publish readiness, and change request sections |
| Assignments | `/projects/[projectId]/assignments` shows assignment board and QR placeholder |
| Driver token | `/driver/demo-token` renders Driver Card and activation actions |
| Mission Control | `/mission-control` renders readiness, fleet, exception, timeline, and map placeholders |
| Resources | `/resources/drivers` and `/resources/vehicles` render resource lists and create forms |

## Command Checks

Run `npm install`, `npm run typecheck`, `npm run lint`, `npm run test`, and `NEXT_TELEMETRY_DISABLED=1 npm run build`.

