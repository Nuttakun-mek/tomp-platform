-- 0050_airport_transfer_rls_from_project_members.sql
--
-- Airport Transfer's row-level security (0040) still read the retired
-- airport_transfer_memberships table. Nobody has rows there since 0043/0044
-- moved Airport Transfer roles into project_members (system_key =
-- 'airport_transfer'), so for anyone but a super admin every policy answered
-- "no". It went unnoticed only because every Airport Transfer read uses the
-- service-role client. The day a reader moves to the session-scoped client
-- (TOMP_SCOPED_READS defaults on), it becomes a silent zero-rows outage.
--
-- The policies now read project_members, scoped to the project a row belongs
-- to, with the same manager roles the app uses (airport_admin,
-- airport_dispatcher — lib/auth/system-roles.ts SYSTEM_MANAGER_ROLES):
--   cases                                   -> its own project_id
--   tasks, status_events, flight_snapshots  -> the project of their case
--   audit_logs                              -> the project of their case; a log
--                                              with no case is super-admin only
--   import_batches, import_rows             -> no project column exists, so any
--                                              Airport Transfer member / manager
--                                              (the account-level check 0040
--                                              intended, now read correctly)

create or replace function public.airport_transfer_role_on(target_project uuid, manage boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or (target_project is not null and exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.profile_id
    join public.roles r on r.id = pm.role_id
    where pm.project_id = target_project
      and pm.system_key = 'airport_transfer'
      and pm.status = 'active'
      and p.auth_user_id = (select auth.uid())
      and (not manage or r.role_key in ('airport_admin', 'airport_dispatcher'))
  ))
$$;

create or replace function public.airport_transfer_case_role(target_case uuid, manage boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or (target_case is not null and public.airport_transfer_role_on(
    (select c.project_id from public.airport_transfer_cases c where c.id = target_case),
    manage
  ))
$$;

-- Account-level: an active Airport Transfer role on any project. Only the import
-- tables, which carry no project, still use these.
create or replace function public.has_airport_transfer_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.profile_id
    where pm.system_key = 'airport_transfer'
      and pm.status = 'active'
      and p.auth_user_id = (select auth.uid())
  )
$$;

create or replace function public.can_manage_airport_transfer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.profile_id
    join public.roles r on r.id = pm.role_id
    where pm.system_key = 'airport_transfer'
      and pm.status = 'active'
      and p.auth_user_id = (select auth.uid())
      and r.role_key in ('airport_admin', 'airport_dispatcher')
  )
$$;

revoke all on function public.airport_transfer_role_on(uuid, boolean) from public, anon;
revoke all on function public.airport_transfer_case_role(uuid, boolean) from public, anon;
grant execute on function public.airport_transfer_role_on(uuid, boolean), public.airport_transfer_case_role(uuid, boolean) to authenticated, service_role;

-- cases: their own project.
drop policy if exists airport_transfer_read on public.airport_transfer_cases;
create policy airport_transfer_read on public.airport_transfer_cases
  for select to authenticated using (public.airport_transfer_role_on(project_id, false));
drop policy if exists airport_transfer_manage on public.airport_transfer_cases;
create policy airport_transfer_manage on public.airport_transfer_cases
  for all to authenticated
  using (public.airport_transfer_role_on(project_id, true))
  with check (public.airport_transfer_role_on(project_id, true));

-- Rows that hang off a case: the case's project.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'airport_transfer_tasks',
    'airport_transfer_status_events',
    'airport_transfer_flight_snapshots',
    'airport_transfer_audit_logs'
  ] loop
    execute format('drop policy if exists airport_transfer_read on public.%I', table_name);
    execute format('create policy airport_transfer_read on public.%I for select to authenticated using (public.airport_transfer_case_role(case_id, false))', table_name);
    execute format('drop policy if exists airport_transfer_manage on public.%I', table_name);
    execute format('create policy airport_transfer_manage on public.%I for all to authenticated using (public.airport_transfer_case_role(case_id, true)) with check (public.airport_transfer_case_role(case_id, true))', table_name);
  end loop;
end $$;

-- import_batches / import_rows keep 0040's policies, which call the two
-- account-level functions redefined above.
