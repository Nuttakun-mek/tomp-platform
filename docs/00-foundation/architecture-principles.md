# Architecture Principles

## Modular Monolith First

TOMP starts as a modular monolith. Domain boundaries are explicit in code, documentation, database design, and API contracts, but deployment remains simple while the product is young.

Initial modules:

- Projects.
- Missions.
- Assignments.
- Drivers.
- Vehicles.
- Call Signs.
- Published Plans.
- Change Events.
- Timeline.
- Audit.
- Access.
- GPS Tracking.

## PWA-First

Field users may operate from mobile devices under imperfect conditions. Core experiences should be responsive, installable, fast to load, and resilient to intermittent connectivity where possible.

## Supabase as Platform Backend

Supabase is the default backend foundation:

- Postgres for operational data.
- Auth for operation users.
- RLS for scoped access.
- Storage for supporting files.
- Realtime where live coordination needs it.
- Edge Functions when server-side workflows are needed near the platform.

## Vercel as Application Runtime

Vercel hosts the Next.js web application. Server-side behavior should remain compatible with Vercel deployment constraints.

## Explicit Operational History

Operational data that affects the published plan cannot be silently overwritten after publish. Post-publish updates produce change events and timeline entries.

## Navigation Boundary

TOMP does not replace Google Maps. TOMP creates operational assignments and deep links to Google Maps for navigation.

## GPS Boundary

GPS tracking exists to improve coordinator visibility and timeline accuracy. It must not be treated as driver control.

## Scale Without Premature Distribution

The system should use clean domain boundaries, typed contracts, and clear migrations so modules can be extracted later if real load or team structure requires it.
