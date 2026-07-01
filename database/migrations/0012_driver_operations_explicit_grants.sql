-- Explicit Data API grants for Supabase 2026 default-privilege change.
-- No anonymous access is granted. Service role is server-only; authenticated reads are protected by RLS policies.

grant select, insert, update, delete on table
  driver_assignment_packets,
  driver_notifications,
  route_change_instructions,
  driver_location_sessions,
  driver_contact_events,
  driver_acknowledgements
to service_role;

grant select on table
  driver_assignment_packets,
  driver_notifications,
  route_change_instructions,
  driver_location_sessions,
  driver_contact_events,
  driver_acknowledgements
to authenticated;

-- Keep driver-facing writes through server actions/API routes only.
-- Do not grant anon access to driver operation tables.
