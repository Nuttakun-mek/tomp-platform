-- 0040_airport_transfer_foundation.sql
-- Airport Transfer is a bounded module inside the TOMP deployment.  Its data
-- stays in explicitly prefixed tables and is invisible to ordinary TOMP users
-- unless they have an active module membership.  Platform super-admins retain
-- break-glass access so the first membership can be provisioned safely.

create table if not exists public.airport_transfer_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null check (role_key in ('airport_admin', 'airport_dispatcher', 'airport_coordinator', 'airport_driver', 'airport_viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

create table if not exists public.airport_transfer_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  case_code text not null unique,
  direction text not null check (direction in ('arrival', 'departure')),
  client_name text,
  passenger_title text,
  passenger_first_name text not null,
  passenger_last_name text not null,
  passenger_email text,
  passenger_mobile text,
  passenger_count integer not null default 1 check (passenger_count > 0),
  luggage_count integer not null default 0 check (luggage_count >= 0),
  travel_date date not null,
  flight_number text not null,
  origin_airport text,
  destination_airport text,
  scheduled_departure_at timestamptz,
  scheduled_arrival_at timestamptz,
  pickup_name text not null,
  pickup_address text,
  pickup_maps_url text,
  dropoff_name text not null,
  dropoff_address text,
  dropoff_maps_url text,
  recommended_pickup_at timestamptz,
  confirmed_pickup_at timestamptz,
  pickup_time_override_reason text,
  vehicle_type text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_plate_snapshot text,
  driver_name_snapshot text,
  driver_phone_snapshot text,
  fast_track boolean not null default false,
  notes text,
  flight_verification_status text not null default 'pending'
    check (flight_verification_status in ('pending', 'verified', 'partial_match', 'route_mismatch', 'date_mismatch', 'multiple_matches', 'not_found', 'manual_confirmed', 'needs_recheck', 'provider_unavailable')),
  flight_provider text,
  flight_provider_checked_at timestamptz,
  operational_status text not null default 'draft'
    check (operational_status in ('draft', 'needs_review', 'verified', 'ready_to_assign', 'assigned', 'driver_notified', 'driver_confirmed', 'vehicle_en_route', 'vehicle_arrived', 'passenger_met', 'passenger_on_board', 'en_route', 'arrived_destination', 'completed', 'issue', 'cancelled')),
  next_action_at timestamptz,
  external_tomp_project_id uuid references public.projects(id) on delete set null,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.airport_transfer_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.airport_transfer_cases(id) on delete cascade,
  task_key text not null,
  label text not null,
  owner_role text not null default 'airport_dispatcher',
  sequence integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped', 'cancelled')),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, task_key)
);

create table if not exists public.airport_transfer_status_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.airport_transfer_cases(id) on delete cascade,
  from_status text,
  to_status text not null,
  event_type text not null default 'status_changed',
  note text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.airport_transfer_flight_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.airport_transfer_cases(id) on delete cascade,
  provider text not null,
  verification_status text not null,
  scheduled_departure_at timestamptz,
  estimated_departure_at timestamptz,
  actual_departure_at timestamptz,
  scheduled_arrival_at timestamptz,
  estimated_arrival_at timestamptz,
  actual_arrival_at timestamptz,
  provider_status text,
  confidence text not null default 'unknown' check (confidence in ('confirmed', 'observed', 'inferred', 'unknown')),
  raw_payload jsonb,
  observed_at timestamptz not null default now()
);

create table if not exists public.airport_transfer_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'validating', 'ready', 'imported', 'failed', 'cancelled')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  warning_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.airport_transfer_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.airport_transfer_import_batches(id) on delete cascade,
  row_number integer not null,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'warning', 'error', 'duplicate', 'imported')),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_messages jsonb not null default '[]'::jsonb,
  imported_case_id uuid references public.airport_transfer_cases(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create table if not exists public.airport_transfer_audit_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.airport_transfer_cases(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists airport_transfer_cases_action_idx on public.airport_transfer_cases(next_action_at, operational_status);
create index if not exists airport_transfer_cases_travel_idx on public.airport_transfer_cases(travel_date, direction);
create index if not exists airport_transfer_cases_flight_idx on public.airport_transfer_cases(flight_number, travel_date);
create index if not exists airport_transfer_cases_organization_idx on public.airport_transfer_cases(organization_id);
create index if not exists airport_transfer_cases_vehicle_idx on public.airport_transfer_cases(vehicle_id);
create index if not exists airport_transfer_cases_driver_idx on public.airport_transfer_cases(driver_id);
create index if not exists airport_transfer_cases_tomp_project_idx on public.airport_transfer_cases(external_tomp_project_id);
create index if not exists airport_transfer_cases_created_by_idx on public.airport_transfer_cases(created_by);
create index if not exists airport_transfer_tasks_case_idx on public.airport_transfer_tasks(case_id, sequence);
create index if not exists airport_transfer_tasks_completed_by_idx on public.airport_transfer_tasks(completed_by);
create index if not exists airport_transfer_status_events_case_idx on public.airport_transfer_status_events(case_id, occurred_at desc);
create index if not exists airport_transfer_status_events_actor_idx on public.airport_transfer_status_events(actor_profile_id);
create index if not exists airport_transfer_flight_snapshots_case_idx on public.airport_transfer_flight_snapshots(case_id, observed_at desc);
create index if not exists airport_transfer_import_batches_created_by_idx on public.airport_transfer_import_batches(created_by);
create index if not exists airport_transfer_import_rows_imported_case_idx on public.airport_transfer_import_rows(imported_case_id);
create index if not exists airport_transfer_audit_case_idx on public.airport_transfer_audit_logs(case_id, occurred_at desc);
create index if not exists airport_transfer_audit_actor_idx on public.airport_transfer_audit_logs(actor_profile_id);

drop trigger if exists airport_transfer_memberships_set_updated_at on public.airport_transfer_memberships;
create trigger airport_transfer_memberships_set_updated_at before update on public.airport_transfer_memberships for each row execute function public.set_updated_at();
drop trigger if exists airport_transfer_cases_set_updated_at on public.airport_transfer_cases;
create trigger airport_transfer_cases_set_updated_at before update on public.airport_transfer_cases for each row execute function public.set_updated_at();
drop trigger if exists airport_transfer_tasks_set_updated_at on public.airport_transfer_tasks;
create trigger airport_transfer_tasks_set_updated_at before update on public.airport_transfer_tasks for each row execute function public.set_updated_at();

create or replace function public.has_airport_transfer_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.airport_transfer_memberships m
    join public.profiles p on p.id = m.profile_id
    where p.auth_user_id = (select auth.uid()) and m.status = 'active'
  )
$$;

create or replace function public.can_manage_airport_transfer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.airport_transfer_memberships m
    join public.profiles p on p.id = m.profile_id
    where p.auth_user_id = (select auth.uid())
      and m.status = 'active'
      and m.role_key in ('airport_admin', 'airport_dispatcher')
  )
$$;

revoke all on function public.has_airport_transfer_access() from public, anon;
revoke all on function public.can_manage_airport_transfer() from public, anon;
grant execute on function public.has_airport_transfer_access(), public.can_manage_airport_transfer() to authenticated, service_role;

alter table public.airport_transfer_memberships enable row level security;
alter table public.airport_transfer_cases enable row level security;
alter table public.airport_transfer_tasks enable row level security;
alter table public.airport_transfer_status_events enable row level security;
alter table public.airport_transfer_flight_snapshots enable row level security;
alter table public.airport_transfer_import_batches enable row level security;
alter table public.airport_transfer_import_rows enable row level security;
alter table public.airport_transfer_audit_logs enable row level security;

drop policy if exists airport_transfer_memberships_select on public.airport_transfer_memberships;
create policy airport_transfer_memberships_select on public.airport_transfer_memberships
for select to authenticated
using (public.is_super_admin() or profile_id = public.current_profile_id());

drop policy if exists airport_transfer_memberships_manage on public.airport_transfer_memberships;
create policy airport_transfer_memberships_manage on public.airport_transfer_memberships
for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'airport_transfer_cases',
    'airport_transfer_tasks',
    'airport_transfer_status_events',
    'airport_transfer_flight_snapshots',
    'airport_transfer_import_batches',
    'airport_transfer_import_rows',
    'airport_transfer_audit_logs'
  ] loop
    execute format('drop policy if exists airport_transfer_read on public.%I', table_name);
    execute format('create policy airport_transfer_read on public.%I for select to authenticated using (public.has_airport_transfer_access())', table_name);
    execute format('drop policy if exists airport_transfer_manage on public.%I', table_name);
    execute format('create policy airport_transfer_manage on public.%I for all to authenticated using (public.can_manage_airport_transfer()) with check (public.can_manage_airport_transfer())', table_name);
  end loop;
end $$;

revoke all on table
  public.airport_transfer_memberships,
  public.airport_transfer_cases,
  public.airport_transfer_tasks,
  public.airport_transfer_status_events,
  public.airport_transfer_flight_snapshots,
  public.airport_transfer_import_batches,
  public.airport_transfer_import_rows,
  public.airport_transfer_audit_logs
from anon;

grant select, insert, update, delete on table
  public.airport_transfer_memberships,
  public.airport_transfer_cases,
  public.airport_transfer_tasks,
  public.airport_transfer_status_events,
  public.airport_transfer_flight_snapshots,
  public.airport_transfer_import_batches,
  public.airport_transfer_import_rows,
  public.airport_transfer_audit_logs
to authenticated, service_role;
