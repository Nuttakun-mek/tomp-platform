-- 0025_timeline_write_triggers.sql
-- ---------------------------------------------------------------------------
-- 957 P0-4: make the immutable audit event atomic with the business write.
--
-- Today an action inserts a business row, then separately calls
-- createTimelineEvent(); a failure of the second write becomes a warning, so
-- the database can hold a change with no audit event. These AFTER triggers
-- write the timeline_events row inside the SAME transaction as the business
-- insert/update — you cannot commit one without the other.
--
-- ROLLOUT (do NOT auto-apply to production):
--   1. Apply on a disposable / staging database. Verify:
--        insert a project  -> exactly one PROJECT_CREATED timeline row
--        insert an assignment_status_updates row -> one ASSIGNMENT_STATUS_CHANGED
--        force the timeline insert to fail (e.g. drop the FK temporarily) ->
--          the business insert rolls back
--   2. Deploy the app change that removes the now-redundant app-side
--      createTimelineEvent() calls for the covered events (see
--      docs/11-codex/959). During the gap the 20s de-dup guard below keeps
--      app + trigger from double-logging.
--   3. Apply on production, then deploy the app change.
-- ---------------------------------------------------------------------------

create or replace function public.tg_append_timeline()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type  text := TG_ARGV[0];
  v_object_type text := TG_ARGV[1];
  v_id_col      text := coalesce(TG_ARGV[2], 'id');
  -- the projects table's own project id is `id`, not `project_id`
  v_pid_col     text := coalesce(TG_ARGV[3], 'project_id');
  v_row         jsonb := to_jsonb(NEW);
  v_project_id  uuid := nullif(v_row ->> v_pid_col, '')::uuid;
  v_object_id   uuid := nullif(v_row ->> v_id_col, '')::uuid;
begin
  if v_project_id is null then
    return NEW;
  end if;

  -- De-dup guard for the rollout window: if the application already wrote an
  -- equivalent event in the last 20 seconds, don't write a second one.
  if exists (
    select 1
    from public.timeline_events
    where event_type = v_event_type
      and object_id is not distinct from v_object_id
      and created_at > now() - interval '20 seconds'
  ) then
    return NEW;
  end if;

  insert into public.timeline_events (project_id, object_type, object_id, event_type, source, after_data, metadata)
  values (v_project_id, v_object_type, v_object_id, v_event_type, 'system', v_row, jsonb_build_object('trigger', TG_NAME, 'writer', 'db_trigger'));

  return NEW;
end;
$$;

revoke all on function public.tg_append_timeline() from public;

-- INSERT triggers ----------------------------------------------------------
drop trigger if exists trg_timeline_project_created on public.projects;
create trigger trg_timeline_project_created
  after insert on public.projects
  for each row execute function public.tg_append_timeline('PROJECT_CREATED', 'project', 'id', 'id');

drop trigger if exists trg_timeline_mission_created on public.missions;
create trigger trg_timeline_mission_created
  after insert on public.missions
  for each row execute function public.tg_append_timeline('MISSION_CREATED', 'mission', 'id');

drop trigger if exists trg_timeline_assignment_created on public.assignments;
create trigger trg_timeline_assignment_created
  after insert on public.assignments
  for each row execute function public.tg_append_timeline('ASSIGNMENT_CREATED', 'assignment', 'id');

drop trigger if exists trg_timeline_status_changed on public.assignment_status_updates;
create trigger trg_timeline_status_changed
  after insert on public.assignment_status_updates
  for each row execute function public.tg_append_timeline('ASSIGNMENT_STATUS_CHANGED', 'assignment', 'assignment_id');

drop trigger if exists trg_timeline_driver_checkin on public.driver_checkins;
create trigger trg_timeline_driver_checkin
  after insert on public.driver_checkins
  for each row execute function public.tg_append_timeline('DRIVER_CHECKED_IN', 'assignment', 'assignment_id');

drop trigger if exists trg_timeline_driver_issue on public.driver_issue_reports;
create trigger trg_timeline_driver_issue
  after insert on public.driver_issue_reports
  for each row execute function public.tg_append_timeline('DRIVER_ISSUE_REPORTED', 'assignment', 'assignment_id');

drop trigger if exists trg_timeline_change_request on public.change_requests;
create trigger trg_timeline_change_request
  after insert on public.change_requests
  for each row execute function public.tg_append_timeline('CHANGE_REQUEST_CREATED', 'change_request', 'id');

drop trigger if exists trg_timeline_publish on public.publish_snapshots;
create trigger trg_timeline_publish
  after insert on public.publish_snapshots
  for each row execute function public.tg_append_timeline('PROJECT_PUBLISHED', 'project', 'project_id');

-- UPDATE trigger: assignment cancellation ---------------------------------
create or replace function public.tg_timeline_assignment_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.status = 'cancelled' and OLD.status is distinct from 'cancelled' then
    if not exists (
      select 1 from public.timeline_events
      where event_type = 'ASSIGNMENT_CANCELLED'
        and object_id = NEW.id
        and created_at > now() - interval '20 seconds'
    ) then
      insert into public.timeline_events (project_id, object_type, object_id, event_type, source, before_data, after_data, metadata)
      values (NEW.project_id, 'assignment', NEW.id, 'ASSIGNMENT_CANCELLED', 'system', to_jsonb(OLD), to_jsonb(NEW), jsonb_build_object('trigger', TG_NAME, 'writer', 'db_trigger'));
    end if;
  end if;
  return NEW;
end;
$$;

revoke all on function public.tg_timeline_assignment_cancelled() from public;

drop trigger if exists trg_timeline_assignment_cancelled on public.assignments;
create trigger trg_timeline_assignment_cancelled
  after update of status on public.assignments
  for each row execute function public.tg_timeline_assignment_cancelled();
