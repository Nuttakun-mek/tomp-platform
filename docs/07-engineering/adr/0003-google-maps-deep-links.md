# ADR 0003: Use Google Maps Deep Links for Navigation

## Status

Accepted.

## Context

Drivers need reliable navigation, but TOMP's product boundary is operations management, not turn-by-turn routing.

## Decision

Use Google Maps deep links for navigation from driver assignments.

## Consequences

- TOMP avoids rebuilding mature navigation behavior.
- Assignments can open destination routes on mobile devices.
- TOMP remains responsible for operational context, baseline, timeline, and audit.
