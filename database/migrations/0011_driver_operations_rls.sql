-- Driver operations RLS foundation.
-- No anon access. Web server actions use service role server-side only.
-- Project-scoped RBAC should be tightened further after real auth pilot.

alter table driver_assignment_packets enable row level security;
alter table driver_notifications enable row level security;
alter table route_change_instructions enable row level security;
alter table driver_location_sessions enable row level security;
alter table driver_contact_events enable row level security;
alter table driver_acknowledgements enable row level security;

create policy "service role manages driver assignment packets"
on driver_assignment_packets for all
to service_role
using (true)
with check (true);

create policy "service role manages driver notifications"
on driver_notifications for all
to service_role
using (true)
with check (true);

create policy "service role manages route change instructions"
on route_change_instructions for all
to service_role
using (true)
with check (true);

create policy "service role manages driver location sessions"
on driver_location_sessions for all
to service_role
using (true)
with check (true);

create policy "service role manages driver contact events"
on driver_contact_events for all
to service_role
using (true)
with check (true);

create policy "service role manages driver acknowledgements"
on driver_acknowledgements for all
to service_role
using (true)
with check (true);

create policy "project members read driver assignment packets"
on driver_assignment_packets for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_assignment_packets.project_id
      and p.user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

create policy "project members read driver notifications"
on driver_notifications for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_notifications.project_id
      and p.user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

create policy "project members read route changes"
on route_change_instructions for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = route_change_instructions.project_id
      and p.user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

create policy "project members read location sessions"
on driver_location_sessions for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_location_sessions.project_id
      and p.user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

create policy "project members read contact events"
on driver_contact_events for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_contact_events.project_id
      and p.user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

create policy "project members read acknowledgements"
on driver_acknowledgements for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_acknowledgements.project_id
      and p.user_id = (select auth.uid())
      and pm.status = 'active'
  )
);
