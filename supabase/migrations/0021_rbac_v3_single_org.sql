-- Phase F — collapse the RBAC model for a single-org product.
--
-- 1. timeline_events purge escape hatch (immutability trigger blocks cascade deletes)
-- 2. public.purge_smoke_test_data() — remove rows the smoke/live-test tools created
-- 3. project-scope read policies: drop the org branch (single org -> it leaked every
--    driver/vehicle to every member)
-- 4. reseed role_permissions with the 2-tier matrix (super_admin + 4 project roles)
--
-- The 5 unused roles (organization_admin, operation_manager, planner, vendor, organizer)
-- are left in public.roles but get no permissions and are removed from the app.

-- ---------------------------------------------------------------------------
-- 1. timeline_events immutability — allow DELETE only inside a purge session
-- ---------------------------------------------------------------------------

create or replace function public.prevent_timeline_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and current_setting('tomp.allow_timeline_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'timeline_events are immutable';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. purge smoke-test data (service-role only)
-- ---------------------------------------------------------------------------

create or replace function public.purge_smoke_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events int; v_projects int; v_drivers int; v_vehicles int; v_profiles int; v_orgs int;
begin
  set local tomp.allow_timeline_purge = 'on';

  delete from public.timeline_events te
  using public.projects p
  where te.project_id = p.id and p.metadata->>'smokeTest' = 'true';
  get diagnostics v_events = row_count;

  delete from public.projects where metadata->>'smokeTest' = 'true';
  get diagnostics v_projects = row_count;

  delete from public.drivers where metadata->>'smokeTest' = 'true';
  get diagnostics v_drivers = row_count;

  delete from public.vehicles where metadata->>'smokeTest' = 'true';
  get diagnostics v_vehicles = row_count;

  delete from public.profiles where metadata->>'smokeTest' = 'true';
  get diagnostics v_profiles = row_count;

  delete from public.organizations where metadata->>'smokeTest' = 'true';
  get diagnostics v_orgs = row_count;

  return jsonb_build_object(
    'timeline_events', v_events, 'projects', v_projects, 'drivers', v_drivers,
    'vehicles', v_vehicles, 'profiles', v_profiles, 'organizations', v_orgs
  );
end;
$$;

revoke all on function public.purge_smoke_test_data() from public, anon, authenticated;
grant execute on function public.purge_smoke_test_data() to service_role;

-- ---------------------------------------------------------------------------
-- 3. project-scope read policies — single-org: super_admin OR project membership
-- ---------------------------------------------------------------------------

create or replace function public.can_read_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or public.is_project_member(target_project)
$$;

drop policy if exists "rbac_select_projects" on public.projects;
create policy "rbac_select_projects"
on public.projects for select to authenticated
using (public.is_super_admin() or public.is_project_member(id));

drop policy if exists "rbac_select_drivers" on public.drivers;
create policy "rbac_select_drivers"
on public.drivers for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.assignments a
    where a.driver_id = drivers.id and public.is_project_member(a.project_id)
  )
);

drop policy if exists "rbac_select_vehicles" on public.vehicles;
create policy "rbac_select_vehicles"
on public.vehicles for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.assignments a
    where a.vehicle_id = vehicles.id and public.is_project_member(a.project_id)
  )
);

-- ---------------------------------------------------------------------------
-- 4. reseed role_permissions — 2-tier matrix
-- ---------------------------------------------------------------------------

delete from public.role_permissions;

with matrix(role_key, permission_key) as (
  values
    ('super_admin', '*'),

    ('project_manager', 'project.read'), ('project_manager', 'project.create'),
    ('project_manager', 'project.update'), ('project_manager', 'project.publish'),
    ('project_manager', 'mission.read'), ('project_manager', 'mission.create'),
    ('project_manager', 'assignment.read'), ('project_manager', 'assignment.create'),
    ('project_manager', 'assignment.update'), ('project_manager', 'driver.read'),
    ('project_manager', 'vehicle.read'), ('project_manager', 'timeline.read'),
    ('project_manager', 'change.create'),

    ('dispatcher', 'project.read'), ('dispatcher', 'mission.read'),
    ('dispatcher', 'assignment.read'), ('dispatcher', 'assignment.create'),
    ('dispatcher', 'assignment.update'), ('dispatcher', 'driver.read'),
    ('dispatcher', 'vehicle.read'), ('dispatcher', 'timeline.read'),

    ('coordinator', 'project.read'), ('coordinator', 'mission.read'),
    ('coordinator', 'assignment.read'), ('coordinator', 'timeline.read'),

    ('customer_viewer', 'project.read'), ('customer_viewer', 'mission.read'),
    ('customer_viewer', 'timeline.read'), ('customer_viewer', 'change.create')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.roles r on r.role_key = m.role_key
join public.permissions p on p.permission_key = m.permission_key
on conflict (role_id, permission_id) do nothing;
