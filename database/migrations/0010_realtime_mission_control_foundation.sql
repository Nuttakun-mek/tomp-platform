-- Sprint 20: Realtime Mission Control foundation.
-- Enables publication for operational read models. This is not production GPS streaming.

alter publication supabase_realtime add table public.timeline_events;
alter publication supabase_realtime add table public.assignment_status_updates;
alter publication supabase_realtime add table public.driver_checkins;
alter publication supabase_realtime add table public.vehicle_checkins;
alter publication supabase_realtime add table public.driver_issue_reports;

