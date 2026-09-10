-- 0031: Call Sign becomes the crewed operating unit.
--
-- Phase 1 only:
-- - Add driver/vehicle pairing to call_signs.
-- - Backfill existing call signs from their current assignments.
-- - Enforce one active call sign per driver and vehicle within a project.
-- - Keep existing assignment-scoped QR tokens unchanged.

alter table public.call_signs
  add column if not exists driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;

create table if not exists public.call_sign_crew_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  call_sign_id uuid not null references public.call_signs(id) on delete cascade,
  previous_driver_id uuid references public.drivers(id) on delete set null,
  previous_vehicle_id uuid references public.vehicles(id) on delete set null,
  next_driver_id uuid references public.drivers(id) on delete set null,
  next_vehicle_id uuid references public.vehicles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

with ranked as (
  select distinct on (a.call_sign_id)
    a.call_sign_id,
    a.driver_id,
    a.vehicle_id
  from public.assignments a
  where a.call_sign_id is not null
    and (a.driver_id is not null or a.vehicle_id is not null)
  order by a.call_sign_id, a.created_at desc
)
update public.call_signs cs
set
  driver_id = coalesce(cs.driver_id, ranked.driver_id),
  vehicle_id = coalesce(cs.vehicle_id, ranked.vehicle_id),
  updated_at = now(),
  metadata = coalesce(cs.metadata, '{}'::jsonb) || jsonb_build_object('crewBackfilledFromAssignments', true)
from ranked
where cs.id = ranked.call_sign_id
  and (cs.driver_id is null or cs.vehicle_id is null);

with duplicates as (
  select
    id,
    row_number() over (partition by project_id, driver_id order by updated_at desc, id) as rn
  from public.call_signs
  where driver_id is not null
    and status = 'active'
    and archived_at is null
    and deleted_at is null
)
update public.call_signs cs
set
  driver_id = null,
  metadata = coalesce(cs.metadata, '{}'::jsonb) || jsonb_build_object('crewBackfillDriverConflict', true)
from duplicates
where cs.id = duplicates.id
  and duplicates.rn > 1;

with duplicates as (
  select
    id,
    row_number() over (partition by project_id, vehicle_id order by updated_at desc, id) as rn
  from public.call_signs
  where vehicle_id is not null
    and status = 'active'
    and archived_at is null
    and deleted_at is null
)
update public.call_signs cs
set
  vehicle_id = null,
  metadata = coalesce(cs.metadata, '{}'::jsonb) || jsonb_build_object('crewBackfillVehicleConflict', true)
from duplicates
where cs.id = duplicates.id
  and duplicates.rn > 1;

create index if not exists call_signs_project_driver_idx on public.call_signs(project_id, driver_id) where driver_id is not null;
create index if not exists call_signs_project_vehicle_idx on public.call_signs(project_id, vehicle_id) where vehicle_id is not null;
create index if not exists call_sign_crew_events_project_idx on public.call_sign_crew_events(project_id);
create index if not exists call_sign_crew_events_call_sign_idx on public.call_sign_crew_events(call_sign_id);

create unique index if not exists call_signs_one_active_driver_per_project_idx
on public.call_signs(project_id, driver_id)
where driver_id is not null and status = 'active' and archived_at is null and deleted_at is null;

create unique index if not exists call_signs_one_active_vehicle_per_project_idx
on public.call_signs(project_id, vehicle_id)
where vehicle_id is not null and status = 'active' and archived_at is null and deleted_at is null;

alter table public.call_sign_crew_events enable row level security;

grant select, insert on public.call_sign_crew_events to authenticated;
grant all on public.call_sign_crew_events to service_role;

drop policy if exists "rbac_select_call_sign_crew_events" on public.call_sign_crew_events;
create policy "rbac_select_call_sign_crew_events"
on public.call_sign_crew_events for select to authenticated
using (public.is_project_member(project_id) or public.is_super_admin());

drop policy if exists "rbac_insert_call_sign_crew_events" on public.call_sign_crew_events;
create policy "rbac_insert_call_sign_crew_events"
on public.call_sign_crew_events for insert to authenticated
with check (public.is_project_member(project_id) or public.is_super_admin());

comment on column public.call_signs.driver_id is 'Phase 1 crewed-unit pairing: current driver assigned to this Call Sign slot for the project.';
comment on column public.call_signs.vehicle_id is 'Phase 1 crewed-unit pairing: current vehicle assigned to this Call Sign slot for the project.';
comment on table public.call_sign_crew_events is 'Immutable audit trail for Call Sign crew changes. Existing assignment-scoped QR tokens are not changed in phase 1.';
