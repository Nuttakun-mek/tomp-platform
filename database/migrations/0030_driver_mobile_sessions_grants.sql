-- 0030_driver_mobile_sessions_grants.sql
-- ---------------------------------------------------------------------------
-- 0029 created public.driver_mobile_sessions with RLS + a revoke from anon /
-- authenticated, but no explicit grant to service_role. Production already has
-- the privilege via Supabase's default grants, but every other server-only
-- table in this repo states it explicitly (0011 gps_locations, 0012 driver_*,
-- 0027 command_log) so the disposable-DB verify scripts and any future Supabase
-- default-privilege change stay correct. Idempotent.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.driver_mobile_sessions to service_role;
revoke all on public.driver_mobile_sessions from anon, authenticated;
