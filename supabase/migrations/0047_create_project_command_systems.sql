-- 0047_create_project_command_systems.sql
-- docs/11-codex/985 "Project creation": one new required section on project
-- creation, "ระบบที่จะใช้ในโครงการนี้" — everything else about creating a
-- project is unchanged.

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
  p_metadata            jsonb,
  p_system_keys         text[]
) returns public.projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project     public.projects;
  v_pm_role_id  uuid;
  v_system_key  text;
  v_top_role    text;
  v_role_id     uuid;
  v_has_prior   boolean;
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

  foreach v_system_key in array coalesce(p_system_keys, array['ground_transfer']) loop
    insert into public.project_systems (project_id, system_key, enabled_by)
    values (v_project.id, v_system_key, p_creator_profile_id)
    on conflict (project_id, system_key) do nothing;

    if p_creator_profile_id is not null then
      v_top_role := case v_system_key when 'airport_transfer' then 'airport_admin' else 'project_manager' end;

      select exists (
        select 1 from public.project_members
        where profile_id = p_creator_profile_id and system_key = v_system_key and status = 'active'
      ) into v_has_prior;

      if v_has_prior or v_system_key = 'ground_transfer' then
        select id into v_role_id from public.roles where role_key = v_top_role limit 1;
        if v_role_id is not null then
          insert into public.project_members (project_id, profile_id, role_id, system_key, status, metadata)
          values (v_project.id, p_creator_profile_id, v_role_id, v_system_key, 'active', jsonb_build_object('source', 'project_create'))
          on conflict (project_id, system_key, profile_id) do nothing;
        end if;
      end if;
    end if;
  end loop;

  return v_project;
end;
$$;

revoke all on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb,text[]) to service_role;

-- The old 11-argument signature is superseded, not dropped — dropping it
-- would break any in-flight request still holding the old signature during
-- a rolling deploy. Left for a later cleanup migration once confirmed unused.
