-- Sprint 31: Driver live location pilot.
-- This enables browser geolocation testing through server-side writes and
-- Supabase Realtime reads for Mission Control. It is not production GPS tracking.

alter table public.gps_locations
  add column if not exists speed numeric,
  add column if not exists heading numeric,
  add column if not exists altitude numeric,
  add column if not exists sharing_event text not null default 'location_ping';

alter table public.gps_locations
  drop constraint if exists gps_locations_sharing_event_check;

alter table public.gps_locations
  add constraint gps_locations_sharing_event_check
  check (sharing_event in ('sharing_started', 'location_ping', 'sharing_stopped'));

create index if not exists gps_locations_project_recorded_idx
  on public.gps_locations(project_id, recorded_at desc);

create index if not exists gps_locations_assignment_recorded_idx
  on public.gps_locations(assignment_id, recorded_at desc);

grant select on public.gps_locations to authenticated;
grant all on public.gps_locations to service_role;

-- Keep anonymous clients away from raw location rows. Driver writes go through
-- the Next.js server API, and Mission Control realtime requires an authenticated
-- operations/admin session for real projects.
revoke all on public.gps_locations from anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gps_locations'
  ) then
    alter publication supabase_realtime add table public.gps_locations;
  end if;
end $$;

comment on table public.gps_locations is
  'Driver live location pilot telemetry. Do not treat as production fleet tracking.';

comment on column public.gps_locations.sharing_event is
  'Pilot event marker: sharing_started, location_ping, or sharing_stopped.';
