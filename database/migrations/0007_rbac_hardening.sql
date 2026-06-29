-- Sprint 16 compatibility migration: RBAC hardening notes and narrower write policies.
-- This file is additive because earlier sprint files already used 0007 for publish locks.

grant select on public.roles, public.permissions, public.role_permissions, public.project_members to authenticated;

drop policy if exists "project_members_insert_missions" on public.missions;
create policy "project_members_insert_missions"
on public.missions for insert
to authenticated
with check (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = missions.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

drop policy if exists "project_members_insert_assignments" on public.assignments;
create policy "project_members_insert_assignments"
on public.assignments for insert
to authenticated
with check (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = assignments.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));
