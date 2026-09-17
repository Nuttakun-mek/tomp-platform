-- 0041_airport_transfer_lifecycle.sql
-- Adds reversible case lifecycle controls and observable flight-provider health.

alter table public.airport_transfer_cases
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists airport_transfer_cases_active_monitor_idx
  on public.airport_transfer_cases(travel_date, flight_provider_checked_at)
  where deleted_at is null and operational_status not in ('completed', 'cancelled');

create index if not exists airport_transfer_cases_deleted_idx
  on public.airport_transfer_cases(deleted_at desc)
  where deleted_at is not null;

create table if not exists public.airport_transfer_api_health (
  provider text primary key,
  connection_status text not null default 'not_configured'
    check (connection_status in ('not_configured', 'idle', 'checking', 'healthy', 'degraded', 'error', 'paused')),
  polling_enabled boolean not null default true,
  polling_interval_minutes integer not null default 10 check (polling_interval_minutes between 1 and 1440),
  active_case_count integer not null default 0 check (active_case_count >= 0),
  checked_case_count integer not null default 0 check (checked_case_count >= 0),
  failed_case_count integer not null default 0 check (failed_case_count >= 0),
  last_check_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  next_check_at timestamptz,
  sync_lock_token uuid,
  sync_lock_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.airport_transfer_api_health(provider)
values ('aerodatabox')
on conflict (provider) do nothing;

drop trigger if exists airport_transfer_api_health_set_updated_at on public.airport_transfer_api_health;
create trigger airport_transfer_api_health_set_updated_at
before update on public.airport_transfer_api_health
for each row execute function public.set_updated_at();

alter table public.airport_transfer_api_health enable row level security;

drop policy if exists airport_transfer_api_health_read on public.airport_transfer_api_health;
create policy airport_transfer_api_health_read on public.airport_transfer_api_health
for select to authenticated
using (public.has_airport_transfer_access());

drop policy if exists airport_transfer_api_health_manage on public.airport_transfer_api_health;
create policy airport_transfer_api_health_manage on public.airport_transfer_api_health
for all to authenticated
using (public.can_manage_airport_transfer())
with check (public.can_manage_airport_transfer());

revoke all on table public.airport_transfer_api_health from anon;
grant select, insert, update, delete on table public.airport_transfer_api_health to authenticated, service_role;

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
  where provider = 'aerodatabox'
    and (sync_lock_until is null or sync_lock_until < now() or sync_lock_token = p_token);

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.claim_airport_transfer_api_sync(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_airport_transfer_api_sync(uuid, integer) to service_role;
