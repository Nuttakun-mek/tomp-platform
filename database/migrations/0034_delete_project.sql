-- 0034_delete_project.sql
-- Delete a project for real, not just hide it.
--
-- Archiving was the only option, so a project created by mistake — a typo in the
-- code, a duplicate, a rehearsal — stayed in the database forever and kept its
-- name reserved by the unique constraint on project_code.
--
-- A plain `delete from projects` cannot work: the cascade reaches
-- timeline_events, whose immutability trigger raises and takes the whole
-- statement down with it. 0021 already solved that for the smoke-test purge with
-- a session flag the trigger honours; this reuses it rather than inventing a
-- second way to get past the same trigger.

create or replace function public.delete_project(target_project uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_name text;
  v_events int;
  v_assignments int;
  v_call_signs int;
begin
  select project_code, project_name into v_code, v_name
  from public.projects where id = target_project;

  if v_code is null then
    raise exception 'project % not found', target_project using errcode = 'no_data_found';
  end if;

  -- Only for this transaction, and only for the deletes below.
  set local tomp.allow_timeline_purge = 'on';

  select count(*) into v_assignments from public.assignments where project_id = target_project;
  select count(*) into v_call_signs from public.call_signs where project_id = target_project;

  -- Timeline rows are what the cascade cannot remove on its own, so they go
  -- first, deliberately, while the flag is set.
  delete from public.timeline_events where project_id = target_project;
  get diagnostics v_events = row_count;

  -- Everything else hangs off the project by `on delete cascade`: operation
  -- days, missions, call signs, assignments, QR tokens, observer links, GPS
  -- rows, mobile sessions, check-ins and packets.
  delete from public.projects where id = target_project;

  return jsonb_build_object(
    'projectId', target_project,
    'projectCode', v_code,
    'projectName', v_name,
    'timelineEvents', v_events,
    'assignments', v_assignments,
    'callSigns', v_call_signs
  );
end;
$$;

revoke all on function public.delete_project(uuid) from public, anon, authenticated;
grant execute on function public.delete_project(uuid) to service_role;

comment on function public.delete_project(uuid) is
  'Permanently removes a project and everything cascading from it, including its otherwise-immutable timeline. Service role only; the application requires a typed confirmation of the project code first.';

-- Deleting a project is the most destructive thing the product can do, so it
-- gets its own permission rather than riding on project.update: a dispatcher who
-- may reschedule work must not be able to erase the project it belongs to.
insert into public.permissions (permission_key, permission_name, description)
values ('project.delete', 'ลบโครงการ', 'ลบโครงการถาวรพร้อมข้อมูลทั้งหมด')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.role_key = 'project_manager' and p.permission_key = 'project.delete'
on conflict do nothing;
