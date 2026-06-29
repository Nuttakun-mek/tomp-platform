-- Sprint 10: transitional project-scoped RLS policies.
-- These policies prepare replacement for Sprint 2 broad authenticated policies.
-- Local development can still use service role from server-only code.

drop policy if exists "sprint2_authenticated_read_projects" on public.projects;
drop policy if exists "sprint2_authenticated_read_project_days" on public.project_days;
drop policy if exists "sprint2_authenticated_read_sessions" on public.sessions;
drop policy if exists "sprint2_authenticated_read_missions" on public.missions;
drop policy if exists "sprint2_authenticated_read_call_signs" on public.call_signs;
drop policy if exists "sprint2_authenticated_read_assignments" on public.assignments;
drop policy if exists "sprint2_authenticated_read_assignment_versions" on public.assignment_versions;
drop policy if exists "sprint2_authenticated_read_timeline_events" on public.timeline_events;

create policy "project_members_select_projects"
on public.projects for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    join public.profiles p on p.id = pm.profile_id
    where pm.project_id = projects.id
      and pm.status = 'active'
      and p.auth_user_id = (select auth.uid())
  )
);

create policy "project_members_select_project_days"
on public.project_days for select
to authenticated
using (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = project_days.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

create policy "project_members_select_sessions"
on public.sessions for select
to authenticated
using (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = sessions.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

create policy "project_members_select_missions"
on public.missions for select
to authenticated
using (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = missions.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

create policy "project_members_select_call_signs"
on public.call_signs for select
to authenticated
using (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = call_signs.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

create policy "project_members_select_assignments"
on public.assignments for select
to authenticated
using (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = assignments.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

create policy "project_members_select_assignment_versions"
on public.assignment_versions for select
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    join public.project_members pm on pm.project_id = a.project_id
    join public.profiles p on p.id = pm.profile_id
    where a.id = assignment_versions.assignment_id
      and pm.status = 'active'
      and p.auth_user_id = (select auth.uid())
  )
);

create policy "project_members_select_timeline_events"
on public.timeline_events for select
to authenticated
using (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = timeline_events.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

create policy "project_members_insert_timeline_events"
on public.timeline_events for insert
to authenticated
with check (exists (select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id where pm.project_id = timeline_events.project_id and pm.status = 'active' and p.auth_user_id = (select auth.uid())));

