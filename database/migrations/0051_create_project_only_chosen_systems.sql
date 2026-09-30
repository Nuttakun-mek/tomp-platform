-- 0051_create_project_only_chosen_systems.sql
-- A project created for Airport Transfer only came out with Ground Transfer as
-- well: 0047 added 'ground_transfer' to every project unconditionally, because
-- the creator was only granted Airport Transfer if they already held it
-- somewhere, and a project with no system its creator could manage would be
-- orphaned. Grant the creator the top role on every chosen system instead, and
-- keep exactly the systems chosen.

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
  v_project      public.projects;
  v_pm_role_id   uuid;
  v_system_key   text;
  v_top_role     text;
  v_role_id      uuid;
  v_system_keys  text[];
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

  -- The systems the creator chose, and only those (an empty or null list
  -- still means Ground Transfer). 0047 unioned Ground Transfer into every
  -- project so that one could never be left without a manager; the creator is
  -- now granted the top role on each chosen system below, which removes that
  -- risk, so an Airport-Transfer-only project stays Airport-Transfer-only.
  select array_agg(distinct k) into v_system_keys
  from unnest(
    case when coalesce(array_length(p_system_keys, 1), 0) = 0 then array['ground_transfer'] else p_system_keys end
  ) as k
  where k in ('ground_transfer', 'airport_transfer');
  if v_system_keys is null then
    v_system_keys := array['ground_transfer'];
  end if;

  foreach v_system_key in array v_system_keys loop
    insert into public.project_systems (project_id, system_key, enabled_by)
    values (v_project.id, v_system_key, p_creator_profile_id)
    on conflict (project_id, system_key) do nothing;

    if p_creator_profile_id is not null then
      v_top_role := case v_system_key when 'airport_transfer' then 'airport_admin' else 'project_manager' end;

      -- The creator runs every system they chose for the project.
      select id into v_role_id from public.roles where role_key = v_top_role limit 1;
      if v_role_id is not null then
        insert into public.project_members (project_id, profile_id, role_id, system_key, status, metadata)
        values (v_project.id, p_creator_profile_id, v_role_id, v_system_key, 'active', jsonb_build_object('source', 'project_create'))
        on conflict (project_id, system_key, profile_id) do nothing;
      end if;
    end if;
  end loop;

  return v_project;
end;
$$;

revoke all on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.create_project_command(uuid,uuid,uuid,text,text,date,date,text,text,text,jsonb,text[]) to service_role;
