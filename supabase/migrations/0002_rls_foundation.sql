-- Sprint 2 temporary RLS foundation.
-- These development policies are intentionally broad for authenticated users
-- and must be replaced by project-scoped RBAC before production use.
-- No public anonymous access is granted here.

grant usage on schema public to authenticated;

grant select, insert, update on
  public.organizations,
  public.profiles,
  public.projects,
  public.project_days,
  public.sessions,
  public.missions,
  public.call_signs,
  public.vehicles,
  public.drivers,
  public.assignments,
  public.assignment_versions,
  public.timeline_events
to authenticated;

grant all on
  public.organizations,
  public.profiles,
  public.projects,
  public.project_days,
  public.sessions,
  public.missions,
  public.call_signs,
  public.vehicles,
  public.drivers,
  public.assignments,
  public.assignment_versions,
  public.timeline_events
to service_role;

create policy "sprint2_authenticated_read_organizations"
on public.organizations for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_profiles"
on public.profiles for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_projects"
on public.projects for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_project_days"
on public.project_days for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_sessions"
on public.sessions for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_missions"
on public.missions for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_call_signs"
on public.call_signs for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_vehicles"
on public.vehicles for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_drivers"
on public.drivers for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_assignments"
on public.assignments for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_assignment_versions"
on public.assignment_versions for select
to authenticated
using (true);

create policy "sprint2_authenticated_read_timeline_events"
on public.timeline_events for select
to authenticated
using (true);

-- Placeholder insert policy: authenticated operation users may append timeline
-- events during development. Replace with project-scoped checks before live use.
create policy "sprint2_authenticated_insert_timeline_events"
on public.timeline_events for insert
to authenticated
with check (true);

-- Service-role keys bypass RLS in Supabase. Keep service-role credentials
-- server-only and document every use. No anon policies are created.
