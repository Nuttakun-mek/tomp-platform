-- Security hardening for the TOMP migration tracking table.
-- This table is operational metadata, not application data. Because it lives in
-- public, Supabase advisors require RLS to be enabled for PostgREST safety.

do $$
begin
  if to_regclass('public.schema_migrations_tomp') is not null then
    alter table public.schema_migrations_tomp enable row level security;

    revoke all on public.schema_migrations_tomp from anon;
    revoke all on public.schema_migrations_tomp from authenticated;

    grant select, insert, update, delete on public.schema_migrations_tomp to service_role;

    comment on table public.schema_migrations_tomp is
      'Internal TOMP migration tracking table. RLS enabled and client roles revoked; server/service role only.';
  end if;
end
$$;
