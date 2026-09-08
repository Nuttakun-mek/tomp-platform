-- Sprint 10: Auth and project-scoped RBAC foundation.
-- This introduces roles, permissions, and project membership without enterprise SSO.

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  role_name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  permission_name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint role_permissions_unique unique (role_id, permission_id)
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint project_members_status_check check (status in ('active', 'inactive', 'invited', 'removed')),
  constraint project_members_unique unique (project_id, profile_id, role_id)
);

create table public.user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  constraint user_role_assignments_status_check check (status in ('active', 'inactive', 'revoked'))
);

create index project_members_project_id_idx on public.project_members(project_id);
create index project_members_profile_id_idx on public.project_members(profile_id);
create index user_role_assignments_profile_id_idx on public.user_role_assignments(profile_id);
create index user_role_assignments_project_id_idx on public.user_role_assignments(project_id);

create trigger roles_set_updated_at before update on public.roles for each row execute function public.set_updated_at();
create trigger permissions_set_updated_at before update on public.permissions for each row execute function public.set_updated_at();
create trigger project_members_set_updated_at before update on public.project_members for each row execute function public.set_updated_at();
create trigger user_role_assignments_set_updated_at before update on public.user_role_assignments for each row execute function public.set_updated_at();

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.project_members enable row level security;
alter table public.user_role_assignments enable row level security;

grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant select, insert, update on public.project_members, public.user_role_assignments to authenticated;
grant all on public.roles, public.permissions, public.role_permissions, public.project_members, public.user_role_assignments to service_role;

insert into public.roles (role_key, role_name, description)
values
  ('super_admin', 'Super Admin', 'Platform level administration.'),
  ('organization_admin', 'Organization Admin', 'Organization administration.'),
  ('project_manager', 'Project Manager', 'Project owner and publish accountability.'),
  ('operation_manager', 'Operation Manager', 'Live operation leadership.'),
  ('planner', 'Planner', 'Plan and mission setup.'),
  ('dispatcher', 'Dispatcher', 'Assignment and dispatch coordination.'),
  ('coordinator', 'Coordinator', 'Scoped field coordination.'),
  ('driver', 'Driver', 'Driver QR access scope.'),
  ('organizer', 'Organizer', 'Scoped organizer visibility.'),
  ('customer_viewer', 'Customer Viewer', 'Read-only customer stakeholder visibility.'),
  ('vendor', 'Vendor', 'Scoped provider visibility.')
on conflict (role_key) do nothing;

insert into public.permissions (permission_key, permission_name)
values
  ('project.read', 'Read projects'),
  ('project.create', 'Create projects'),
  ('project.update', 'Update projects'),
  ('project.publish', 'Publish projects'),
  ('mission.read', 'Read missions'),
  ('mission.create', 'Create missions'),
  ('mission.update', 'Update missions'),
  ('assignment.read', 'Read assignments'),
  ('assignment.create', 'Create assignments'),
  ('assignment.update', 'Update assignments'),
  ('driver.read', 'Read drivers'),
  ('driver.update', 'Update drivers'),
  ('vehicle.read', 'Read vehicles'),
  ('vehicle.update', 'Update vehicles'),
  ('timeline.read', 'Read timeline'),
  ('timeline.create', 'Create timeline'),
  ('admin.manage_users', 'Manage users')
on conflict (permission_key) do nothing;

