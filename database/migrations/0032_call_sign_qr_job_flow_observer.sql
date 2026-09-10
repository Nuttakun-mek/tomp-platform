-- 0032_call_sign_qr_job_flow_observer.sql
-- Phase 2-4 of the Call Sign as crewed unit plan.
-- Driver QR can now be scoped to a Call Sign while old assignment-scoped QR
-- links remain valid. Observer access is a separate read-only credential.

alter table public.driver_access_tokens
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete cascade;

create index if not exists driver_access_tokens_call_sign_id_idx
  on public.driver_access_tokens(call_sign_id);

update public.driver_access_tokens dat
set call_sign_id = a.call_sign_id
from public.assignments a
where dat.assignment_id = a.id
  and dat.call_sign_id is null;

alter table public.driver_assignment_packets
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete set null;

create index if not exists idx_driver_assignment_packets_call_sign
  on public.driver_assignment_packets(call_sign_id);

update public.driver_assignment_packets dap
set call_sign_id = a.call_sign_id
from public.assignments a
where dap.assignment_id = a.id
  and dap.call_sign_id is null;

alter table public.driver_notifications
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete set null;

create index if not exists idx_driver_notifications_call_sign
  on public.driver_notifications(call_sign_id);

alter table public.route_change_instructions
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete set null;

create index if not exists idx_route_change_instructions_call_sign
  on public.route_change_instructions(call_sign_id);

alter table public.driver_mobile_sessions
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete cascade;

update public.driver_mobile_sessions dms
set call_sign_id = a.call_sign_id
from public.assignments a
where dms.assignment_id = a.id
  and dms.call_sign_id is null;

alter table public.driver_mobile_sessions
  alter column assignment_id drop not null;

create index if not exists driver_mobile_sessions_call_sign_id_idx
  on public.driver_mobile_sessions(call_sign_id);

alter table public.driver_location_sessions
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete set null;

create index if not exists idx_driver_location_sessions_call_sign
  on public.driver_location_sessions(call_sign_id);

alter table public.gps_locations
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete set null;

update public.gps_locations gl
set call_sign_id = a.call_sign_id
from public.assignments a
where gl.assignment_id = a.id
  and gl.call_sign_id is null;

create index if not exists gps_locations_call_sign_id_idx
  on public.gps_locations(call_sign_id);

alter table public.driver_contact_events
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete set null;

create index if not exists idx_driver_contact_events_call_sign
  on public.driver_contact_events(call_sign_id);

alter table public.driver_acknowledgements
  add column if not exists call_sign_id uuid references public.call_signs(id) on delete set null;

create index if not exists idx_driver_acknowledgements_call_sign
  on public.driver_acknowledgements(call_sign_id);

alter table public.assignments
  drop constraint if exists assignments_status_check;

alter table public.assignments
  add constraint assignments_status_check
  check (status in ('draft', 'planned', 'published', 'acknowledged', 'active', 'parked', 'completed', 'cancelled', 'archived'));

create unique index if not exists assignments_one_active_job_per_call_sign_idx
  on public.assignments(project_id, call_sign_id)
  where call_sign_id is not null
    and status = 'active'
    and archived_at is null
    and deleted_at is null;

create table if not exists public.observer_access_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  call_sign_id uuid not null references public.call_signs(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  constraint observer_access_tokens_status_check check (status in ('active', 'revoked', 'expired'))
);

create index if not exists observer_access_tokens_project_id_idx
  on public.observer_access_tokens(project_id);
create index if not exists observer_access_tokens_call_sign_id_idx
  on public.observer_access_tokens(call_sign_id);
create index if not exists observer_access_tokens_status_idx
  on public.observer_access_tokens(status);
create index if not exists observer_access_tokens_expires_at_idx
  on public.observer_access_tokens(expires_at);

alter table public.observer_access_tokens enable row level security;
revoke all on public.observer_access_tokens from anon, authenticated;
grant all on public.observer_access_tokens to service_role;

comment on column public.driver_access_tokens.call_sign_id is
  'Call Sign-scoped QR identity. Existing assignment_id remains for backward compatibility and initial job snapshot.';
comment on table public.observer_access_tokens is
  'Read-only observer credential for vehicle/call-sign visibility. It must never unlock driver write actions.';
comment on index public.assignments_one_active_job_per_call_sign_idx is
  'Prevents a Call Sign from running more than one active job at the same time.';
