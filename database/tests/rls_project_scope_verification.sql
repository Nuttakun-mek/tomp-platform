-- TOMP project-scoped RLS verification checklist.
-- Run this against a staging Supabase database with two real auth users and
-- project memberships before declaring production readiness.

-- Required setup variables for manual execution:
-- :user_a_auth_id
-- :user_b_auth_id
-- :project_a_id
-- :project_b_id

-- 1. Verify profiles are mapped to auth users.
select id, auth_user_id, organization_id, full_name
from public.profiles
where auth_user_id in (:'user_a_auth_id', :'user_b_auth_id');

-- 2. Verify project membership exists only for the intended project.
select pm.project_id, p.full_name, r.role_key
from public.project_members pm
join public.profiles p on p.id = pm.profile_id
join public.roles r on r.id = pm.role_id
where p.auth_user_id in (:'user_a_auth_id', :'user_b_auth_id')
order by pm.project_id, p.full_name;

-- 3. Expected with authenticated session for user A:
-- select * from public.projects should return project A and not project B.
-- select * from public.assignments should return assignments under project A and not project B.

-- 4. Expected with authenticated session for user B:
-- select * from public.projects should return project B and not project A.
-- select * from public.timeline_events should return project-scoped events only.

-- 5. Expected anonymous access:
-- anon role must not read operational tables.

-- 6. Expected service role access:
-- service role can read/write for controlled server-side actions only.
