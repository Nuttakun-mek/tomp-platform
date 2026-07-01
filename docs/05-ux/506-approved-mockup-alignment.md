# TOMP Approved Mockup Alignment

## Approved Visual Direction

TOMP must read as a Thai-first transportation operations command platform, not a generic admin dashboard. The approved direction uses a dark command sidebar, a light operational workspace, dense but calm status panels, and clear Thai labels for people who need to make decisions quickly.

## Layout Rules

- Desktop uses a fixed command sidebar and a wide workspace.
- Primary pages start with a command header, then KPI/status strips, then task panels.
- Cards must carry operational value: readiness, risk, current assignment, next action, or timeline.
- Use "ข้อมูลตัวอย่าง" when fallback/demo data is displayed.

## Sidebar Rules

- Sidebar is dark command style.
- Navigation is grouped by operating intent: control, planning, resources, access.
- Active state must be obvious.
- Environment and version must be visible.

## Dashboard Rules

- Dashboard answers: what is active, what is ready, what needs attention, what should be opened next.
- Avoid isolated generic cards.
- Quick actions should map to real pilot flow.

## Mission Control Rules

- Mission Control must prioritize map, active assignments, driver signal, risk, and timeline.
- Realtime state must be visible without blocking the page.
- Risk colors must be meaningful: green ready, amber watch, red critical, blue active.

## Driver Mobile Rules

- Driver view must be readable within five seconds.
- Call Sign, route, next action, Google Maps, and contact buttons must be prominent.
- Dense admin information must not appear in driver view.

## Project Workspace Rules

- Project page must show planning vs operation status.
- Missions, assignments, readiness, publish, change, and timeline shortcuts must be visible.

## Assignment Board Rules

- Assignment page behaves like a dispatch board.
- Group cards by status and show Call Sign, driver, vehicle, time, QR, readiness, and risk.

## Thai Copy Rules

- Thai-first copy is mandatory.
- Allowed English terms: TOMP, Call Sign, QR, GPS, Google Maps, Mission Control when paired with Thai meaning.
- Avoid raw database field names.

## What Must Not Be Changed

- Do not add AI, route optimization, fleet maintenance, ERP, CRM, payroll, or accounting.
- Do not expose service-role keys in browser code.
- Do not remove timeline immutability.
