create table public.driver_access_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  token_hash text not null unique,
  access_scope text not null default 'assignment',
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint driver_access_tokens_status_check check (status in ('active', 'revoked', 'expired'))
);

create table public.driver_checkins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  status text not null default 'pending',
  confirmed_name boolean not null default false,
  confirmed_phone boolean not null default false,
  confirmed_vehicle boolean not null default false,
  gps_consent boolean not null default false,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint driver_checkins_status_check check (status in ('pending', 'ready', 'blocked'))
);

create table public.vehicle_checkins (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null default 'pending',
  photo_url text,
  plate_photo_url text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint vehicle_checkins_status_check check (status in ('pending', 'confirmed', 'rejected'))
);

create table public.assignment_status_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null,
  source text not null default 'driver_qr',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint assignment_status_updates_source_check check (source in ('driver_qr', 'operation_user', 'coordinator', 'system'))
);

create table public.gps_locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accuracy numeric,
  recorded_at timestamptz,
  source text not null default 'placeholder',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.driver_issue_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  issue_type text not null,
  severity text not null default 'warning',
  message text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint driver_issue_reports_severity_check check (severity in ('info', 'warning', 'urgent')),
  constraint driver_issue_reports_status_check check (status in ('open', 'acknowledged', 'closed'))
);

create index driver_access_tokens_project_id_idx on public.driver_access_tokens(project_id);
create index driver_access_tokens_assignment_id_idx on public.driver_access_tokens(assignment_id);
create index driver_access_tokens_driver_id_idx on public.driver_access_tokens(driver_id);
create index driver_checkins_project_id_idx on public.driver_checkins(project_id);
create index driver_checkins_assignment_id_idx on public.driver_checkins(assignment_id);
create index driver_checkins_driver_id_idx on public.driver_checkins(driver_id);
create index vehicle_checkins_project_id_idx on public.vehicle_checkins(project_id);
create index vehicle_checkins_assignment_id_idx on public.vehicle_checkins(assignment_id);
create index vehicle_checkins_driver_id_idx on public.vehicle_checkins(driver_id);
create index vehicle_checkins_vehicle_id_idx on public.vehicle_checkins(vehicle_id);
create index assignment_status_updates_project_id_idx on public.assignment_status_updates(project_id);
create index assignment_status_updates_assignment_id_idx on public.assignment_status_updates(assignment_id);
create index assignment_status_updates_driver_id_idx on public.assignment_status_updates(driver_id);
create index gps_locations_project_id_idx on public.gps_locations(project_id);
create index gps_locations_assignment_id_idx on public.gps_locations(assignment_id);
create index gps_locations_driver_id_idx on public.gps_locations(driver_id);
create index gps_locations_vehicle_id_idx on public.gps_locations(vehicle_id);
create index driver_issue_reports_project_id_idx on public.driver_issue_reports(project_id);
create index driver_issue_reports_assignment_id_idx on public.driver_issue_reports(assignment_id);
create index driver_issue_reports_driver_id_idx on public.driver_issue_reports(driver_id);

alter table public.driver_access_tokens enable row level security;
alter table public.driver_checkins enable row level security;
alter table public.vehicle_checkins enable row level security;
alter table public.assignment_status_updates enable row level security;
alter table public.gps_locations enable row level security;
alter table public.driver_issue_reports enable row level security;

grant select, insert, update on
  public.driver_access_tokens,
  public.driver_checkins,
  public.vehicle_checkins,
  public.assignment_status_updates,
  public.gps_locations,
  public.driver_issue_reports
to authenticated;

grant all on
  public.driver_access_tokens,
  public.driver_checkins,
  public.vehicle_checkins,
  public.assignment_status_updates,
  public.gps_locations,
  public.driver_issue_reports
to service_role;

-- Sprint 2 temporary development policies. Replace with project-scoped RBAC
-- before production or before exposing these tables to untrusted clients.
create policy "sprint2_authenticated_read_driver_access_tokens"
on public.driver_access_tokens for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_driver_checkins"
on public.driver_checkins for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_vehicle_checkins"
on public.vehicle_checkins for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_assignment_status_updates"
on public.assignment_status_updates for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_gps_locations"
on public.gps_locations for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_driver_issue_reports"
on public.driver_issue_reports for select
to authenticated
using (true);

create policy "sprint2_authenticated_insert_driver_issue_reports"
on public.driver_issue_reports for insert
to authenticated
with check (true);
