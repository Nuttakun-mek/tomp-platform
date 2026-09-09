# Driver API Contract

## Purpose

This contract prepares a stable boundary for Web Driver and a future Mobile Driver App. The current implementation keeps Web server actions as the primary write path.

## Driver

- `fetchDriverAssignmentBySession(config)` - requires an `x-driver-session` value minted after QR/PIN/device checks.
- `submitDriverReadiness(input)`
- `submitDriverStatusUpdate(input)`
- `submitDriverIssueReport(input)`
- `submitDriverPhotoEvidence(input)`

## Location

- `startDriverLocationSession(input)`
- `submitDriverLocationPing(input)`
- `stopDriverLocationSession(sessionId)`
- `getDriverLocationHealth(sessionId)`

## Notification

- `fetchDriverNotifications(assignmentId)`
- `acknowledgeDriverNotification(notificationId)`
- `markDriverNotificationActioned(notificationId)`

## Assignment

- `fetchAssignmentInstructions(assignmentId)`
- `fetchRouteChangeInstructions(assignmentId)`
- `acknowledgeRouteChange(routeChangeId)`

## Current Behavior

`@tomp/api-client` exposes typed function boundaries. Driver operational endpoints use the scoped driver session, not raw QR tokens in a query string. Native/mobile callers send the session as `x-driver-session`; Web calls use the HttpOnly session cookie.

## Timeline Requirement

Every important driver write must create or prepare a timeline event:

- assignment acknowledged
- readiness submitted
- status updated
- issue reported
- photo evidence submitted
- notification acknowledged
- route change acknowledged
- GPS session started/stopped
