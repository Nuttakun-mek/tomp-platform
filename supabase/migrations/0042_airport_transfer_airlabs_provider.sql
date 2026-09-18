-- 0042_airport_transfer_airlabs_provider.sql
-- Switches the Airport Transfer flight provider health record and sync lock to AirLabs.

insert into public.airport_transfer_api_health (
  provider,
  connection_status,
  polling_enabled,
  polling_interval_minutes,
  active_case_count,
  checked_case_count,
  failed_case_count,
  metadata
)
select
  'airlabs',
  'not_configured',
  polling_enabled,
  greatest(polling_interval_minutes, 30),
  0,
  0,
  0,
  jsonb_build_object('previous_provider', 'aerodatabox', 'migrated_at', now())
from public.airport_transfer_api_health
where provider = 'aerodatabox'
on conflict (provider) do nothing;

insert into public.airport_transfer_api_health(provider, polling_interval_minutes)
values ('airlabs', 30)
on conflict (provider) do nothing;

delete from public.airport_transfer_api_health
where provider = 'aerodatabox';

create or replace function public.claim_airport_transfer_api_sync(
  p_token uuid,
  p_lock_seconds integer default 90
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected_rows integer;
begin
  update public.airport_transfer_api_health
  set sync_lock_token = p_token,
      sync_lock_until = now() + make_interval(secs => greatest(30, least(p_lock_seconds, 300))),
      connection_status = 'checking'
  where provider = 'airlabs'
    and (sync_lock_until is null or sync_lock_until < now() or sync_lock_token = p_token);

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.claim_airport_transfer_api_sync(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_airport_transfer_api_sync(uuid, integer) to service_role;

