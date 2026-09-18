-- 0043_central_permission_foundation.sql
-- Central permission system, Layer 1 + Layer 2 (docs/11-codex/984).
-- Layer 1: a registry of "systems" a login can hold access to.
-- Layer 2: project_members generalized across systems via system_key, so
-- Airport Transfer's roles become project-scoped the same way TOMP's already
-- are, instead of living in the separate, disconnected, empty
-- airport_transfer_memberships table (docs/11-codex/983 §2.5).

create table public.systems (
  key text primary key,
  label_th text not null,
  icon text not null,
  route text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.systems (key, label_th, icon, route, sort_order) values
  ('ground_transfer', 'Ground Transfer', 'CarFront', 'ground-transfer', 0),
  ('airport_transfer', 'Airport Transfer', 'PlaneTakeoff', 'airport-transfer', 1);

grant select on public.systems to authenticated, anon;
grant all on public.systems to service_role;
alter table public.systems enable row level security;
create policy systems_select_all on public.systems for select using (true);

-- Layer 2: one row = one profile, one project, one system, one role.
alter table public.project_members
  add column system_key text not null default 'ground_transfer'
    references public.systems(key);

alter table public.project_members
  drop constraint project_members_unique;
alter table public.project_members
  add constraint project_members_project_system_profile_key
    unique (project_id, system_key, profile_id);

create index project_members_system_key_idx on public.project_members(project_id, system_key);

-- Which systems a project uses. Coarse, person-independent -- "this engagement
-- needs Airport Transfer," not "I personally can do Airport Transfer work."
-- See docs/11-codex/985 Part A, "Where this sits relative to 984."
create table public.project_systems (
  project_id uuid not null references public.projects(id) on delete cascade,
  system_key text not null references public.systems(key),
  enabled_at timestamptz not null default now(),
  enabled_by uuid references public.profiles(id) on delete set null,
  primary key (project_id, system_key)
);

grant select on public.project_systems to authenticated;
grant all on public.project_systems to service_role;
alter table public.project_systems enable row level security;

create policy project_systems_select on public.project_systems
  for select
  using (
    exists (
      select 1 from public.project_members pm
      join public.profiles p on p.id = pm.profile_id
      where pm.project_id = project_systems.project_id
        and pm.status = 'active'
        and p.auth_user_id = (select auth.uid())
    )
  );

-- Every project that already exists uses Ground Transfer today (it is the
-- only system that has ever had projects). Airport Transfer's own project
-- row is backfilled in the next migration once cases have somewhere to point.
insert into public.project_systems (project_id, system_key)
select id, 'ground_transfer' from public.projects
on conflict do nothing;
