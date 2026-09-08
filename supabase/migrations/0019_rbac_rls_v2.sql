-- Phase 3 — RBAC data scoping v2.
--
-- Replaces the broad Sprint 2 "authenticated can read everything" policies with
-- scope-aware policies backed by SECURITY DEFINER helper functions:
--   - super_admin (global user_role_assignments) bypasses every read policy
--   - organization_admin sees everything inside their own organization
--   - everyone else sees only projects they are an active project_members row of
--
-- Writes still go through the service role + requirePermission in server actions;
-- this migration only tightens SELECT (read) access for the `authenticated` role.
--
-- Idempotent: every policy is dropped-if-exists before creation. Helper functions
-- use CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1. Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles
  where auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    join public.profiles p on p.id = ura.profile_id
    where p.auth_user_id = (select auth.uid())
      and ura.status = 'active'
      and ura.project_id is null
      and r.role_key = 'super_admin'
  )
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_org is not null and exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    join public.profiles p on p.id = ura.profile_id
    where p.auth_user_id = (select auth.uid())
      and ura.status = 'active'
      and ura.project_id is null
      and ura.organization_id = target_org
      and r.role_key in ('organization_admin', 'super_admin')
  )
$$;

create or replace function public.is_project_member(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_project is not null and exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.profile_id
    where pm.project_id = target_project
      and pm.status = 'active'
      and p.auth_user_id = (select auth.uid())
  )
$$;

-- helper used by policies that need "am I org-admin for the org that owns this project"
create or replace function public.can_read_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.is_project_member(target_project)
    or exists (
      select 1 from public.projects pr
      where pr.id = target_project
        and public.is_org_admin(pr.organization_id)
    )
$$;

grant execute on function
  public.current_profile_id(),
  public.is_super_admin(),
  public.is_org_admin(uuid),
  public.is_project_member(uuid),
  public.can_read_project(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Project-scoped tables — replace project_members_select_* / sprint2_* reads
-- ---------------------------------------------------------------------------

drop policy if exists "sprint2_authenticated_read_projects" on public.projects;
drop policy if exists "project_members_select_projects" on public.projects;
create policy "rbac_select_projects"
on public.projects for select to authenticated
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
  or public.is_project_member(id)
);

drop policy if exists "sprint2_authenticated_read_project_days" on public.project_days;
drop policy if exists "project_members_select_project_days" on public.project_days;
create policy "rbac_select_project_days"
on public.project_days for select to authenticated
using (public.can_read_project(project_id));

drop policy if exists "sprint2_authenticated_read_sessions" on public.sessions;
drop policy if exists "project_members_select_sessions" on public.sessions;
create policy "rbac_select_sessions"
on public.sessions for select to authenticated
using (public.can_read_project(project_id));

drop policy if exists "sprint2_authenticated_read_missions" on public.missions;
drop policy if exists "project_members_select_missions" on public.missions;
create policy "rbac_select_missions"
on public.missions for select to authenticated
using (public.can_read_project(project_id));

drop policy if exists "sprint2_authenticated_read_call_signs" on public.call_signs;
drop policy if exists "project_members_select_call_signs" on public.call_signs;
create policy "rbac_select_call_signs"
on public.call_signs for select to authenticated
using (public.can_read_project(project_id));

drop policy if exists "sprint2_authenticated_read_assignments" on public.assignments;
drop policy if exists "project_members_select_assignments" on public.assignments;
create policy "rbac_select_assignments"
on public.assignments for select to authenticated
using (public.can_read_project(project_id));

drop policy if exists "sprint2_authenticated_read_assignment_versions" on public.assignment_versions;
drop policy if exists "project_members_select_assignment_versions" on public.assignment_versions;
create policy "rbac_select_assignment_versions"
on public.assignment_versions for select to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_versions.assignment_id
      and public.can_read_project(a.project_id)
  )
);

drop policy if exists "sprint2_authenticated_read_timeline_events" on public.timeline_events;
drop policy if exists "project_members_select_timeline_events" on public.timeline_events;
create policy "rbac_select_timeline_events"
on public.timeline_events for select to authenticated
using (public.can_read_project(project_id));

-- 0002 placeholder insert (with check true) — 0005 already added the scoped insert
drop policy if exists "sprint2_authenticated_insert_timeline_events" on public.timeline_events;

drop policy if exists "project_members_select_publish_locks" on public.publish_locks;
create policy "rbac_select_publish_locks"
on public.publish_locks for select to authenticated
using (public.can_read_project(project_id));

-- ---------------------------------------------------------------------------
-- 3. Driver-operations tables (0011) — add super_admin bypass
-- ---------------------------------------------------------------------------

drop policy if exists "project members read driver assignment packets" on public.driver_assignment_packets;
create policy "rbac_select_driver_assignment_packets"
on public.driver_assignment_packets for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "project members read driver notifications" on public.driver_notifications;
create policy "rbac_select_driver_notifications"
on public.driver_notifications for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "project members read route changes" on public.route_change_instructions;
create policy "rbac_select_route_change_instructions"
on public.route_change_instructions for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "project members read location sessions" on public.driver_location_sessions;
create policy "rbac_select_driver_location_sessions"
on public.driver_location_sessions for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "project members read contact events" on public.driver_contact_events;
create policy "rbac_select_driver_contact_events"
on public.driver_contact_events for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "project members read acknowledgements" on public.driver_acknowledgements;
create policy "rbac_select_driver_acknowledgements"
on public.driver_acknowledgements for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

-- ---------------------------------------------------------------------------
-- 4. Organizations / profiles
-- ---------------------------------------------------------------------------

drop policy if exists "sprint2_authenticated_read_organizations" on public.organizations;
create policy "rbac_select_organizations"
on public.organizations for select to authenticated
using (
  public.is_super_admin()
  or id = (
    select organization_id from public.profiles
    where auth_user_id = (select auth.uid())
    limit 1
  )
);

drop policy if exists "sprint2_authenticated_read_profiles" on public.profiles;
create policy "rbac_select_profiles"
on public.profiles for select to authenticated
using (
  public.is_super_admin()
  or auth_user_id = (select auth.uid())
  or organization_id = (
    select organization_id from public.profiles
    where auth_user_id = (select auth.uid())
    limit 1
  )
);

-- ---------------------------------------------------------------------------
-- 5. Drivers / vehicles — org of resource, or assigned into a project I can read
-- ---------------------------------------------------------------------------

drop policy if exists "sprint2_authenticated_read_drivers" on public.drivers;
create policy "rbac_select_drivers"
on public.drivers for select to authenticated
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
  or organization_id = (
    select organization_id from public.profiles
    where auth_user_id = (select auth.uid())
    limit 1
  )
  or exists (
    select 1 from public.assignments a
    where a.driver_id = drivers.id
      and public.is_project_member(a.project_id)
  )
);

drop policy if exists "sprint2_authenticated_read_vehicles" on public.vehicles;
create policy "rbac_select_vehicles"
on public.vehicles for select to authenticated
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
  or organization_id = (
    select organization_id from public.profiles
    where auth_user_id = (select auth.uid())
    limit 1
  )
  or exists (
    select 1 from public.assignments a
    where a.vehicle_id = vehicles.id
      and public.is_project_member(a.project_id)
  )
);

-- ---------------------------------------------------------------------------
-- 6. GPS + driver-facing tables — project member only (sensitive), + super_admin
-- ---------------------------------------------------------------------------

drop policy if exists "sprint2_authenticated_read_gps_locations" on public.gps_locations;
create policy "rbac_select_gps_locations"
on public.gps_locations for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "sprint2_authenticated_read_driver_issue_reports" on public.driver_issue_reports;
drop policy if exists "sprint2_authenticated_insert_driver_issue_reports" on public.driver_issue_reports;
create policy "rbac_select_driver_issue_reports"
on public.driver_issue_reports for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "sprint2_authenticated_read_driver_access_tokens" on public.driver_access_tokens;
create policy "rbac_select_driver_access_tokens"
on public.driver_access_tokens for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "sprint2_authenticated_read_driver_checkins" on public.driver_checkins;
create policy "rbac_select_driver_checkins"
on public.driver_checkins for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "sprint2_authenticated_read_vehicle_checkins" on public.vehicle_checkins;
create policy "rbac_select_vehicle_checkins"
on public.vehicle_checkins for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

drop policy if exists "sprint2_authenticated_read_assignment_status_updates" on public.assignment_status_updates;
create policy "rbac_select_assignment_status_updates"
on public.assignment_status_updates for select to authenticated
using (public.is_super_admin() or public.is_project_member(project_id));

-- ---------------------------------------------------------------------------
-- 7. project_members — self + fellow members + super_admin
-- ---------------------------------------------------------------------------

drop policy if exists "rbac_select_project_members" on public.project_members;
create policy "rbac_select_project_members"
on public.project_members for select to authenticated
using (
  public.is_super_admin()
  or profile_id = public.current_profile_id()
  or public.is_project_member(project_id)
);
