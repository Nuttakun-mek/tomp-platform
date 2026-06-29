# Realtime Mission Control

Sprint 20 adds a subscribe-only realtime foundation.

## Streams

- `timeline_events`
- `assignment_status_updates`
- `driver_checkins`
- `vehicle_checkins`

## Behavior

Mission Control renders with server data first. Client-side realtime subscriptions enhance the page when Supabase browser env is configured. If env is missing, the page remains usable in fallback mode.

## Boundary

This is not production GPS streaming and does not implement route optimization.

