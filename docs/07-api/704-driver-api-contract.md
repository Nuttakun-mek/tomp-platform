# Driver API Contract

## Purpose

This contract prepares a stable boundary for Web Driver and a future Mobile Driver App. The current implementation keeps Web server actions as the primary write path.

## Driver

- `fetchDriverAssignmentByToken(token)`
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

`@tomp/api-client` exposes typed function boundaries. Functions intentionally throw "Not implemented" until the shared API is wired to stable Web endpoints or API routes.

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
