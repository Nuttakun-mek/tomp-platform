-- Sprint 11: Publish and change baseline.

create table public.publish_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  object_type text not null default 'project',
  object_id uuid,
  status text not null default 'published',
  reason text,
  snapshot_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint publish_snapshots_status_check check (status in ('draft', 'published', 'superseded', 'archived'))
);

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  object_type text not null,
  object_id uuid,
  status text not null default 'requested',
  severity text not null default 'medium',
  reason text not null,
  impact_summary text,
  requested_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  applied_by uuid references auth.users(id),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint change_requests_status_check check (status in ('requested', 'approved', 'applied', 'rejected', 'cancelled')),
  constraint change_requests_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create table public.change_impacts (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.change_requests(id) on delete cascade,
  impact_type text not null,
  impact_summary text not null,
  severity text not null default 'medium',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint change_impacts_severity_check check (severity in ('low', 'medium', 'high', 'critical'))
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  change_request_id uuid references public.change_requests(id) on delete cascade,
  status text not null default 'pending',
  requested_by uuid references auth.users(id),
  decided_by uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint approvals_status_check check (status in ('pending', 'approved', 'rejected'))
);

create index publish_snapshots_project_id_idx on public.publish_snapshots(project_id);
create index change_requests_project_id_idx on public.change_requests(project_id);
create index change_requests_object_idx on public.change_requests(object_type, object_id);
create index change_impacts_change_request_id_idx on public.change_impacts(change_request_id);
create index approvals_project_id_idx on public.approvals(project_id);
create index approvals_change_request_id_idx on public.approvals(change_request_id);

create trigger change_requests_set_updated_at before update on public.change_requests for each row execute function public.set_updated_at();
create trigger approvals_set_updated_at before update on public.approvals for each row execute function public.set_updated_at();

alter table public.publish_snapshots enable row level security;
alter table public.change_requests enable row level security;
alter table public.change_impacts enable row level security;
alter table public.approvals enable row level security;

grant select, insert, update on public.publish_snapshots, public.change_requests, public.change_impacts, public.approvals to authenticated;
grant all on public.publish_snapshots, public.change_requests, public.change_impacts, public.approvals to service_role;

