-- Sprint 18: driver QR token security hardening fields.

alter table public.driver_access_tokens
  add column if not exists issued_by uuid references auth.users(id),
  add column if not exists revoked_at timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists usage_count integer not null default 0;

create index if not exists driver_access_tokens_token_hash_idx on public.driver_access_tokens(token_hash);
create index if not exists driver_access_tokens_status_expires_idx on public.driver_access_tokens(status, expires_at);

