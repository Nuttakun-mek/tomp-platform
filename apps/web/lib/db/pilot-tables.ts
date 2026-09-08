// Single source of truth for the tables the live-test / pilot smoke flow touches.
// The readiness check (Supabase REST and Postgres fallback) and the scenario
// builder must stay in sync with this list, otherwise a health check can report
// "ready" while scenario creation fails on a missing table.
export const PILOT_REQUIRED_TABLES = [
  "organizations",
  "profiles",
  "projects",
  "project_days",
  "sessions",
  "missions",
  "call_signs",
  "drivers",
  "vehicles",
  "assignments",
  "driver_access_tokens",
  "driver_assignment_packets",
  "driver_notifications",
  "route_change_instructions",
  "driver_location_sessions",
  "driver_acknowledgements",
  "gps_locations",
  "timeline_events"
] as const;

export type PilotRequiredTable = (typeof PILOT_REQUIRED_TABLES)[number];
