# Architecture Principles

## Architectural Style

TOMP starts as a **domain-driven modular monolith**.

This allows low-cost development, simpler deployment, and faster iteration while preserving modular boundaries for future scaling.

## Layers

TOMP has seven architecture layers:

1. Business Layer
2. Operation Layer
3. Decision Layer
4. Capability Layer
5. Application Layer
6. Platform Layer
7. Infrastructure Layer

## Service Kernel

The core system should be organized around domain services:

- Project Service
- Mission Service
- Assignment Service
- Call Sign Service
- Driver Service
- Vehicle Service
- Timeline Service
- Notification Service
- Incident Service
- Recovery Service
- Permission Service
- Audit Service
- Knowledge Service

## Event-First Architecture

TOMP should not be designed as CRUD only. Important actions must emit domain events.

Examples:

- PROJECT_CREATED
- PLAN_PUBLISHED
- MISSION_ASSIGNED
- DRIVER_CHECKED_IN
- VEHICLE_ACTIVATED
- GPS_UPDATED
- INCIDENT_OPENED
- RECOVERY_STARTED
- MISSION_COMPLETED
- PROJECT_CLOSED

Events feed:

- Timeline
- Notification
- Audit
- Realtime updates
- Reports
- Knowledge
- Analytics

## Offline Strategy

Some driver-side capabilities must work with unstable network:

- Route sheet viewing
- Status action queue
- GPS queue
- Photo queue
- Checklist queue

When connection returns, the app syncs queued actions.

## No Vendor Lock-In

Use Supabase and Vercel in Version 1, but the architecture must allow migration.

## Map Strategy

Google Maps is used for navigation through deep links. TOMP's map is for operations visibility only.

## Security Strategy

- Role-based access control
- Project-scoped permissions
- Audit trail for important actions
- Token-based QR access with expiry
- No public access to internal operations without scoped token

## Scalability Strategy

Start with 1–2 projects, 10–30 vehicles per project. Architecture must support future growth to many concurrent projects without changing the core domain.
