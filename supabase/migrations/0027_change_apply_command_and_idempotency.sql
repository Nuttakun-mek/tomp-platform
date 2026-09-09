-- 0027_change_apply_command_and_idempotency.sql
-- ---------------------------------------------------------------------------
-- 957 P0-4 (final pieces).
--
-- 1. change_apply_command(): apply an approved change request atomically —
--    patch the target row AND flip change_requests.status in one transaction,
--    so a failed target patch can no longer leave a request marked 'applied'
--    that was not.
--
-- 2. command_log: a client-supplied command_id makes a retried write a no-op.
--    A dropped connection or double-tap on "publish" / "create" no longer
--    creates a duplicate.
-- ---------------------------------------------------------------------------

-- 1. change apply -----------------------------------------------------------
create or replace function public.change_apply_command(
  p_change_request_id uuid,
  p_patch jsonb
) returns public.change_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cr     public.change_requests;
  v_table  text;
  v_patch  jsonb := coalesce(p_patch, '{}'::jsonb);
  v_key    text;
  v_type   text;
begin
  select * into v_cr from public.change_requests where id = p_change_request_id for update;
  if not found then
    raise exception 'change_request_not_found';
  end if;
  if v_cr.status not in ('approved', 'requested') then
    raise exception 'change_request_not_applicable' using detail = v_cr.status;
  end if;

  v_table := case v_cr.object_type
    when 'project' then 'projects'
    when 'mission' then 'missions'
    when 'assignment' then 'assignments'
    when 'call_sign' then 'call_signs'
    else null
  end;

  -- Patch the target one column at a time. `->>` gives text; Postgres applies
  -- the assignment cast to the real column type (text -> int/timestamptz/jsonb).
  if v_table is not null and v_cr.object_id is not null and jsonb_typeof(v_patch) = 'object' then
    for v_key in select jsonb_object_keys(v_patch) loop
      if v_key = 'id' then
        continue;
      end if;
      select pg_catalog.format_type(a.atttypid, a.atttypmod) into v_type
      from pg_catalog.pg_attribute a
      where a.attrelid = ('public.' || v_table)::regclass
        and a.attname = v_key and a.attnum > 0 and not a.attisdropped;
      if v_type is null then
        continue;
      end if;
      if v_type in ('jsonb', 'json') then
        execute format('update public.%I set %I = $1 where id = $2', v_table, v_key)
          using (v_patch -> v_key), v_cr.object_id;
      else
        -- text value cast to the real column type (int, timestamptz, uuid, ...)
        execute format('update public.%I set %I = $1::%s where id = $2', v_table, v_key, v_type)
          using (v_patch ->> v_key), v_cr.object_id;
      end if;
    end loop;
  end if;

  update public.change_requests
    set status = 'applied', after_data = coalesce(p_patch, after_data), updated_at = now()
  where id = p_change_request_id
  returning * into v_cr;

  return v_cr;
end;
$$;

revoke all on function public.change_apply_command(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.change_apply_command(uuid, jsonb) to service_role;


-- 2. idempotency log ------------------------------------------------------
create table if not exists public.command_log (
  command_id  text primary key,
  command     text not null,
  result      jsonb,
  created_at  timestamptz not null default now()
);

alter table public.command_log enable row level security;
revoke all on public.command_log from public, anon, authenticated;
grant select, insert on public.command_log to service_role;

-- Claim a command_id. Returns true if this is the first time it is seen (the
-- caller should run the command), false if it was already handled.
create or replace function public.claim_command(p_command_id text, p_command text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.command_log (command_id, command) values (p_command_id, p_command);
  return true;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.claim_command(text, text) from public, anon, authenticated;
grant execute on function public.claim_command(text, text) to service_role;
