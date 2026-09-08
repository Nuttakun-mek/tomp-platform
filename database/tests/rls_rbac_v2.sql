-- RBAC v2 (migration 0019 + 0020) RLS scope verification.
--
-- Automated runner: node scripts/verify-rls.mjs  (after node scripts/seed-test-users.mjs)
-- This file is the manual/psql equivalent for auditing on staging.
--
-- Setup: run scripts/seed-test-users.mjs, then take the ids it prints:
--   \set super_id   '<users.super.authUserId>'
--   \set orgadmin_id'<users.orgadmin.authUserId>'
--   \set pm1_id     '<users.pm1.authUserId>'
--   \set disp2_id   '<users.disp2.authUserId>'
--   \set project_a  '<projectA>'
--   \set project_b  '<projectB>'

-- ---- super_admin: sees everything ----
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', :'super_id', 'role', 'authenticated')::text, true);
  select 'super sees >= 2 projects' as check, count(*) >= 2 as pass from public.projects;
  select 'super is_super_admin()' as check, public.is_super_admin() as pass;
rollback;

-- ---- organization_admin: whole org, not super ----
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', :'orgadmin_id', 'role', 'authenticated')::text, true);
  select 'orgadmin sees >= 2 projects' as check, count(*) >= 2 as pass from public.projects;
  select 'orgadmin NOT super' as check, public.is_super_admin() = false as pass;
rollback;

-- ---- project_manager on A: only project A ----
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', :'pm1_id', 'role', 'authenticated')::text, true);
  select 'pm1 sees exactly 1 project' as check, count(*) = 1 as pass from public.projects;
  select 'pm1 sees project A' as check, count(*) = 1 as pass from public.projects where id = :'project_a';
  select 'pm1 cannot see project B' as check, count(*) = 0 as pass from public.projects where id = :'project_b';
  select 'pm1 cannot see B gps' as check, count(*) = 0 as pass from public.gps_locations where project_id = :'project_b';
rollback;

-- ---- dispatcher on B: only project B ----
begin;
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', :'disp2_id', 'role', 'authenticated')::text, true);
  select 'disp2 sees project B' as check, count(*) = 1 as pass from public.projects where id = :'project_b';
  select 'disp2 cannot see project A' as check, count(*) = 0 as pass from public.projects where id = :'project_a';
rollback;

-- ---- anon: no operational reads ----
begin;
  set local role anon;
  select 'anon sees 0 projects' as check, count(*) = 0 as pass from public.projects;
rollback;
