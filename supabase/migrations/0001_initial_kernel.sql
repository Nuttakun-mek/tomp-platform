create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_timeline_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'timeline_events are immutable';
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null default 'operator',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint organizations_status_check check (status in ('active', 'inactive', 'archived'))
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint profiles_status_check check (status in ('active', 'inactive', 'invited', 'archived'))
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  project_code text not null unique,
  project_name text not null,
  start_date date not null,
  end_date date not null,
  timezone text not null default 'Asia/Bangkok',
  status text not null default 'draft',
  visibility_level text not null default 'internal',
  service_level text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint projects_date_range_check check (end_date >= start_date),
  constraint projects_status_check check (status in ('draft', 'planning', 'published', 'operating', 'closing', 'closed', 'archived'))
);

create table public.project_days (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  operation_date date not null,
  day_number integer not null,
  timezone text,
  status text not null default 'draft',
  briefing_notes text,
  closing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint project_days_day_number_check check (day_number > 0),
  constraint project_days_status_check check (status in ('draft', 'ready', 'operating', 'closed', 'archived')),
  constraint project_days_project_date_unique unique (project_id, operation_date)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  project_day_id uuid not null references public.project_days(id) on delete cascade,
  session_name text not null,
  session_type text,
  start_time timestamptz,
  end_time timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint sessions_time_range_check check (end_time is null or start_time is null or end_time >= start_time),
  constraint sessions_status_check check (status in ('draft', 'ready', 'operating', 'closed', 'archived'))
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  project_day_id uuid not null references public.project_days(id) on delete restrict,
  session_id uuid references public.sessions(id) on delete set null,
  mission_code text not null,
  mission_name text not null,
  mission_type text not null,
  priority text not null default 'normal',
  status text not null default 'draft',
  planned_start_time timestamptz,
  planned_end_time timestamptz,
  pickup_venue_id uuid,
  dropoff_venue_id uuid,
  instruction text,
  service_commitment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint missions_time_range_check check (planned_end_time is null or planned_start_time is null or planned_end_time >= planned_start_time),
  constraint missions_priority_check check (priority in ('low', 'normal', 'high', 'critical')),
  constraint missions_status_check check (status in ('draft', 'planned', 'published', 'active', 'completed', 'cancelled', 'archived')),
  constraint missions_project_code_unique unique (project_id, mission_code)
);

create table public.call_signs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  call_sign text not null,
  group_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint call_signs_status_check check (status in ('active', 'inactive', 'archived')),
  constraint call_signs_project_unique unique (project_id, call_sign)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  vendor_id uuid,
  plate_number text not null,
  vehicle_type text not null,
  capacity integer not null default 0,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint vehicles_capacity_check check (capacity >= 0),
  constraint vehicles_status_check check (status in ('available', 'assigned', 'out_of_service', 'archived'))
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  vendor_id uuid,
  full_name text not null,
  phone text not null,
  license_type text,
  languages text[] not null default '{}'::text[],
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint drivers_status_check check (status in ('available', 'assigned', 'inactive', 'archived'))
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  call_sign_id uuid not null references public.call_signs(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null default 'draft',
  start_time timestamptz,
  end_time timestamptz,
  commitment_id uuid,
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint assignments_time_range_check check (end_time is null or start_time is null or end_time >= start_time),
  constraint assignments_current_version_check check (current_version > 0),
  constraint assignments_status_check check (status in ('draft', 'planned', 'published', 'active', 'completed', 'cancelled', 'archived'))
);

create table public.assignment_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  version_number integer not null,
  change_reason text,
  before_data jsonb,
  after_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint assignment_versions_version_number_check check (version_number > 0),
  constraint assignment_versions_assignment_version_unique unique (assignment_id, version_number)
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  object_type text not null,
  object_id uuid,
  event_type text not null,
  actor_id uuid references auth.users(id),
  source text not null default 'system',
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint timeline_events_source_check check (source in ('system', 'operation_user', 'driver_qr', 'coordinator', 'organizer', 'import'))
);

create index profiles_auth_user_id_idx on public.profiles(auth_user_id);
create index profiles_organization_id_idx on public.profiles(organization_id);
create index projects_organization_id_idx on public.projects(organization_id);
create index project_days_project_id_idx on public.project_days(project_id);
create index sessions_project_day_id_idx on public.sessions(project_day_id);
create index missions_project_id_idx on public.missions(project_id);
create index missions_project_day_id_idx on public.missions(project_day_id);
create index missions_session_id_idx on public.missions(session_id);
create index call_signs_project_id_idx on public.call_signs(project_id);
create index vehicles_organization_id_idx on public.vehicles(organization_id);
create index drivers_organization_id_idx on public.drivers(organization_id);
create index assignments_project_id_idx on public.assignments(project_id);
create index assignments_mission_id_idx on public.assignments(mission_id);
create index assignment_versions_assignment_id_idx on public.assignment_versions(assignment_id);
create index timeline_events_project_created_at_idx on public.timeline_events(project_id, created_at desc);
create index timeline_events_object_idx on public.timeline_events(object_type, object_id);

create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger project_days_set_updated_at before update on public.project_days for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.sessions for each row execute function public.set_updated_at();
create trigger missions_set_updated_at before update on public.missions for each row execute function public.set_updated_at();
create trigger call_signs_set_updated_at before update on public.call_signs for each row execute function public.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger drivers_set_updated_at before update on public.drivers for each row execute function public.set_updated_at();
create trigger assignments_set_updated_at before update on public.assignments for each row execute function public.set_updated_at();
create trigger timeline_events_prevent_update before update on public.timeline_events for each row execute function public.prevent_timeline_event_mutation();
create trigger timeline_events_prevent_delete before delete on public.timeline_events for each row execute function public.prevent_timeline_event_mutation();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_days enable row level security;
alter table public.sessions enable row level security;
alter table public.missions enable row level security;
alter table public.call_signs enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_versions enable row level security;
alter table public.timeline_events enable row level security;
