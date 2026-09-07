-- Driver operations RLS foundation.
-- No anon access. Web server actions use service role server-side only.
-- Project-scoped RBAC should be tightened further after real auth pilot.
--
-- Idempotent: every policy is dropped-if-exists before creation so this migration
-- can run against a database where an earlier out-of-band apply already created
-- the service-role policies.

alter table driver_assignment_packets enable row level security;
alter table driver_notifications enable row level security;
alter table route_change_instructions enable row level security;
alter table driver_location_sessions enable row level security;
alter table driver_contact_events enable row level security;
alter table driver_acknowledgements enable row level security;

drop policy if exists "service role manages driver assignment packets" on driver_assignment_packets;
create policy "service role manages driver assignment packets"
on driver_assignment_packets for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages driver notifications" on driver_notifications;
create policy "service role manages driver notifications"
on driver_notifications for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages route change instructions" on route_change_instructions;
create policy "service role manages route change instructions"
on route_change_instructions for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages driver location sessions" on driver_location_sessions;
create policy "service role manages driver location sessions"
on driver_location_sessions for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages driver contact events" on driver_contact_events;
create policy "service role manages driver contact events"
on driver_contact_events for all
to service_role
using (true)
with check (true);

drop policy if exists "service role manages driver acknowledgements" on driver_acknowledgements;
create policy "service role manages driver acknowledgements"
on driver_acknowledgements for all
to service_role
using (true)
with check (true);

drop policy if exists "project members read driver assignment packets" on driver_assignment_packets;
create policy "project members read driver assignment packets"
on driver_assignment_packets for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_assignment_packets.project_id
      and p.auth_user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

drop policy if exists "project members read driver notifications" on driver_notifications;
create policy "project members read driver notifications"
on driver_notifications for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_notifications.project_id
      and p.auth_user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

drop policy if exists "project members read route changes" on route_change_instructions;
create policy "project members read route changes"
on route_change_instructions for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = route_change_instructions.project_id
      and p.auth_user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

drop policy if exists "project members read location sessions" on driver_location_sessions;
create policy "project members read location sessions"
on driver_location_sessions for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_location_sessions.project_id
      and p.auth_user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

drop policy if exists "project members read contact events" on driver_contact_events;
create policy "project members read contact events"
on driver_contact_events for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_contact_events.project_id
      and p.auth_user_id = (select auth.uid())
      and pm.status = 'active'
  )
);

drop policy if exists "project members read acknowledgements" on driver_acknowledgements;
create policy "project members read acknowledgements"
on driver_acknowledgements for select
to authenticated
using (
  exists (
    select 1 from project_members pm
    join profiles p on p.id = pm.profile_id
    where pm.project_id = driver_acknowledgements.project_id
      and p.auth_user_id = (select auth.uid())
      and pm.status = 'active'
  )
);
