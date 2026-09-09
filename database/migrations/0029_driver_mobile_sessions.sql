create table if not exists public.driver_mobile_sessions (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.driver_access_tokens(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  device_hash text not null,
  installation_id_hash text,
  challenge_hash text,
  session_hash text,
  status text not null default 'challenge_issued',
  challenge_expires_at timestamptz,
  issued_at timestamptz,
  exchanged_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint driver_mobile_sessions_status_check
    check (status in ('challenge_issued', 'active', 'expired', 'revoked'))
);

create index if not exists driver_mobile_sessions_token_id_idx on public.driver_mobile_sessions(token_id);
create index if not exists driver_mobile_sessions_project_id_idx on public.driver_mobile_sessions(project_id);
create index if not exists driver_mobile_sessions_assignment_id_idx on public.driver_mobile_sessions(assignment_id);
create index if not exists driver_mobile_sessions_driver_id_idx on public.driver_mobile_sessions(driver_id);
create index if not exists driver_mobile_sessions_status_idx on public.driver_mobile_sessions(status);
create index if not exists driver_mobile_sessions_challenge_hash_idx on public.driver_mobile_sessions(challenge_hash);
create index if not exists driver_mobile_sessions_session_hash_idx on public.driver_mobile_sessions(session_hash);
create index if not exists driver_mobile_sessions_expires_at_idx on public.driver_mobile_sessions(expires_at);

alter table public.driver_mobile_sessions enable row level security;
revoke all on public.driver_mobile_sessions from anon, authenticated;

comment on table public.driver_mobile_sessions is
  'Server-only scoped sessions for the future TOMP Driver mobile shell. Raw QR tokens are not stored or accepted for operational background writes.';
comment on column public.driver_mobile_sessions.challenge_hash is
  'Hash of the one-time WebView-to-native exchange code. The raw code is returned once to the active Web session only.';
comment on column public.driver_mobile_sessions.session_hash is
  'Hash of the scoped mobile bearer sent by native background tasks. The raw bearer is returned once during exchange and stored in SecureStore on device.';
