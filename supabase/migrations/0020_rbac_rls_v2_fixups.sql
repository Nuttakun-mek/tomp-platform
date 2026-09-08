-- Phase 3 fixup for 0019: the rbac_select_profiles policy queried public.profiles
-- inside its own USING clause, causing "infinite recursion detected in policy for
-- relation profiles". Route every "my organization" lookup through a SECURITY
-- DEFINER helper (which bypasses RLS) instead of an inline subquery.

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles
  where auth_user_id = (select auth.uid())
  limit 1
$$;

grant execute on function public.current_org_id() to authenticated, service_role;

-- profiles: self OR same org (via helper) OR super_admin
drop policy if exists "rbac_select_profiles" on public.profiles;
create policy "rbac_select_profiles"
on public.profiles for select to authenticated
using (
  public.is_super_admin()
  or auth_user_id = (select auth.uid())
  or (organization_id is not null and organization_id = public.current_org_id())
);

-- organizations: own org (via helper) OR super_admin
drop policy if exists "rbac_select_organizations" on public.organizations;
create policy "rbac_select_organizations"
on public.organizations for select to authenticated
using (
  public.is_super_admin()
  or id = public.current_org_id()
);

-- drivers / vehicles: same org (via helper) instead of inline profiles subquery
drop policy if exists "rbac_select_drivers" on public.drivers;
create policy "rbac_select_drivers"
on public.drivers for select to authenticated
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
  or (organization_id is not null and organization_id = public.current_org_id())
  or exists (
    select 1 from public.assignments a
    where a.driver_id = drivers.id
      and public.is_project_member(a.project_id)
  )
);

drop policy if exists "rbac_select_vehicles" on public.vehicles;
create policy "rbac_select_vehicles"
on public.vehicles for select to authenticated
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
  or (organization_id is not null and organization_id = public.current_org_id())
  or exists (
    select 1 from public.assignments a
    where a.vehicle_id = vehicles.id
      and public.is_project_member(a.project_id)
  )
);
