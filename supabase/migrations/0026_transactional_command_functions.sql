-- 0026_transactional_command_functions.sql
-- ---------------------------------------------------------------------------
-- 957 P0-4 (multi-row commands): a project create and a publish each write
-- several rows that must be all-or-nothing. Today they run as separate
-- statements, so a failure part-way leaves the project without its creator
-- membership, or a publish snapshot with no lock / no status change.
--
-- These SECURITY DEFINER functions do the whole command in one transaction.
-- The Timeline event is written by the 0025 triggers inside the same
-- transaction, so business row + membership/lock + audit event commit together
-- or not at all.
--
-- ROLLOUT: apply 0025 first, then this, on staging. Verify (see 959), then
-- deploy the app change that routes createProjectAction / publishProjectAction
-- through these RPCs. Do NOT auto-apply to production.
-- ---------------------------------------------------------------------------

-- 1. create a project + link the creator as an active project_manager --------
create or replace function public.create_project_command(
  p_organization_id     uuid,
  p_owner_profile_id    uuid,
  p_creator_profile_id  uuid,
  p_project_code        text,
  p_project_name        text,
  p_start_date          date,
  p_end_date            date,
  p_timezone            text,
  p_visibility          text,
  p_service_level       text,
  p_metadata            jsonb
) returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project    public.projects;
  v_pm_role_id uuid;
begin
  if exists (select 1 from public.projects where project_code = p_project_code) then
    raise exception 'project_code_taken' using errcode = '23505';
  end if;

  insert into public.projects
    (organization_id, owner_profile_id, project_code, project_name, start_date, end_date,
     timezone, visibility_level, service_level, status, metadata)
  values
    (p_organization_id, coalesce(p_owner_profile_id, p_creator_profile_id), p_project_code, p_project_name,
     p_start_date, p_end_date, coalesce(nullif(p_timezone, ''), 'Asia/Bangkok'),
     coalesce(nullif(p_visibility, ''), 'internal'), coalesce(nullif(p_service_level, ''), 'standard'),
     'planning', coalesce(p_metadata, '{}'::jsonb))
  returning * into v_project;

  if p_creator_profile_id is not null then
    select id into v_pm_role_id from public.roles where role_key = 'project_manager' limit 1;
    if v_pm_role_id is not null then
      insert into public.project_members (project_id, profile_id, role_id, status, metadata)
      values (v_project.id, p_creator_profile_id, v_pm_role_id, 'active', jsonb_build_object('source', 'project_create'))
      on conflict (project_id, profile_id, role_id) do nothing;
    end if;
  end if;

  return v_project;
end;
$$;

revoke all on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb) to service_role;


-- 2. publish: snapshot + status + lock, atomically --------------------------
-- The app computes readiness (P0-5) and passes the canonical snapshot in; this
-- function only commits the three writes together.
create or replace function public.publish_project_command(
  p_project_id  uuid,
  p_reason      text,
  p_snapshot    jsonb,
  p_metadata    jsonb
) returns public.publish_snapshots
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot public.publish_snapshots;
begin
  if exists (select 1 from public.publish_locks where project_id = p_project_id and status = 'locked') then
    raise exception 'project_already_published';
  end if;

  insert into public.publish_snapshots (project_id, object_type, object_id, status, reason, snapshot_data, metadata)
  values (p_project_id, 'project', p_project_id, 'published', p_reason, coalesce(p_snapshot, '{}'::jsonb),
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('authoritative', true))
  returning * into v_snapshot;

  update public.projects
    set status = 'published', updated_at = now()
  where id = p_project_id and status in ('draft', 'planning');

  insert into public.publish_locks (project_id, locked_by_snapshot_id, status, reason)
  values (p_project_id, v_snapshot.id, 'locked', p_reason);

  return v_snapshot;
end;
$$;

revoke all on function public.publish_project_command(uuid,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.publish_project_command(uuid,text,jsonb,jsonb) to service_role;
