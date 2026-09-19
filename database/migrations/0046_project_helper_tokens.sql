-- 0046_project_helper_tokens.sql
-- docs/11-codex/984 "Granting access": a lightweight, non-expiring, revocable
-- QR/PIN for someone who needs exactly one project and no email account —
-- reusing the SHAPE of driver_access_tokens' device-binding pattern, but its
-- own table, because driver_access_tokens.driver_id/assignment_id are real
-- TOMP-driver concepts a project helper does not have.

create table public.project_helper_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint project_helper_tokens_status_check check (status in ('active', 'revoked'))
);

create index project_helper_tokens_project_idx on public.project_helper_tokens(project_id);
create index project_helper_tokens_profile_idx on public.project_helper_tokens(profile_id);

alter table public.project_helper_tokens enable row level security;
grant select, insert, update on public.project_helper_tokens to authenticated;
grant all on public.project_helper_tokens to service_role;

create policy project_helper_tokens_manage on public.project_helper_tokens
  for all
  using (
    exists (
      select 1 from public.project_members pm
      join public.profiles p on p.id = pm.profile_id
      where pm.project_id = project_helper_tokens.project_id
        and pm.status = 'active'
        and p.auth_user_id = (select auth.uid())
    )
  );
