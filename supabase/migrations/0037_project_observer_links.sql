-- Customer fleet view foundation.
--
-- Existing observer links were scoped to exactly one Call Sign. A customer view
-- needs a project-level, read-only link that can show every assigned unit on one
-- map without exposing operator controls. Driver QR tokens remain separate and
-- hash-only; this migration only extends read-only observer links.

alter table public.observer_access_tokens
  alter column call_sign_id drop not null;

alter table public.observer_access_tokens
  add column if not exists scope text not null default 'call_sign',
  add column if not exists pin_hash text,
  add column if not exists call_sign_ids uuid[],
  add column if not exists show_crew boolean not null default false,
  add column if not exists label text;

alter table public.observer_access_tokens
  drop constraint if exists observer_access_tokens_scope_check;
alter table public.observer_access_tokens
  add constraint observer_access_tokens_scope_check
  check (scope in ('call_sign', 'project'));

alter table public.observer_access_tokens
  drop constraint if exists observer_access_tokens_scope_shape;
alter table public.observer_access_tokens
  add constraint observer_access_tokens_scope_shape check (
    (scope = 'call_sign' and call_sign_id is not null)
    or (scope = 'project' and call_sign_id is null)
  );

create index if not exists observer_access_tokens_scope_idx
  on public.observer_access_tokens(scope);

create index if not exists observer_access_tokens_project_scope_idx
  on public.observer_access_tokens(project_id, scope, status, created_at desc);

comment on column public.observer_access_tokens.scope is
  'Read-only observer scope. call_sign is a single unit; project is the customer fleet view.';
comment on column public.observer_access_tokens.call_sign_ids is
  'Project-scope only: the units this link may see. NULL means every unit in the project.';
comment on column public.observer_access_tokens.show_crew is
  'Whether driver names appear. Phone numbers never appear regardless.';
comment on column public.observer_access_tokens.pin_hash is
  'Optional customer PIN hash. The plaintext PIN is returned once at issue time.';

create table if not exists public.observer_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.observer_access_tokens(id) on delete cascade,
  client_fingerprint text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists observer_pin_attempts_lookup_idx
  on public.observer_pin_attempts(token_id, client_fingerprint, attempted_at desc);

alter table public.observer_pin_attempts enable row level security;
revoke all on public.observer_pin_attempts from anon, authenticated;
grant all on public.observer_pin_attempts to service_role;

comment on table public.observer_pin_attempts is
  'Per-device observer PIN attempts. Failed attempts never revoke a token; this prevents denial-of-service against customer links.';
