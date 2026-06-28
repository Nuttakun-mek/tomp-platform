# API Blueprint v1.0

## API Style

TOMP uses REST for standard resource operations and domain actions for business operations. Realtime events are used for live updates.

## API Principles

- Versioned API paths.
- Project-scoped permissions.
- Domain actions over blind CRUD when business action matters.
- Idempotency for important actions.
- Standard error codes.
- Timeline event on significant actions.

## Base Path

```text
/api/v1
```

## Project APIs

- GET /projects
- POST /projects
- GET /projects/{projectId}
- PATCH /projects/{projectId}
- POST /projects/{projectId}/archive
- GET /projects/{projectId}/timeline

## Planning APIs

- POST /projects/{projectId}/days
- POST /projects/{projectId}/sessions
- POST /projects/{projectId}/missions
- POST /missions/{missionId}/assignments
- POST /projects/{projectId}/publish
- POST /projects/{projectId}/conflict-check
- POST /projects/{projectId}/readiness-check

## Mission APIs

- GET /missions/{missionId}
- PATCH /missions/{missionId}
- POST /missions/{missionId}/cancel
- POST /missions/{missionId}/complete
- GET /missions/{missionId}/assignments

## Assignment APIs

- GET /assignments/{assignmentId}
- POST /assignments/{assignmentId}/replace-driver
- POST /assignments/{assignmentId}/replace-vehicle
- POST /assignments/{assignmentId}/status
- POST /assignments/{assignmentId}/manual-override

## Driver APIs

- POST /driver/access/qr
- GET /driver/me/assignments
- POST /driver/check-in
- POST /driver/vehicle-photo
- POST /driver/plate-photo
- POST /driver/status
- POST /driver/issue
- POST /driver/gps

## Coordinator APIs

- GET /coordinator/scope
- POST /coordinator/confirm-arrival
- POST /coordinator/confirm-boarding
- POST /coordinator/confirm-completion
- POST /coordinator/report-issue

## Change APIs

- POST /change-requests
- GET /change-requests/{id}
- POST /change-requests/{id}/approve
- POST /change-requests/{id}/apply
- POST /change-requests/{id}/reject

## Incident APIs

- POST /incidents
- GET /incidents/{id}
- POST /incidents/{id}/recover
- POST /incidents/{id}/resolve
- POST /incidents/{id}/close

## Realtime Channels

- project:{projectId}:timeline
- project:{projectId}:mission-control
- assignment:{assignmentId}:status
- driver:{driverId}:notifications
