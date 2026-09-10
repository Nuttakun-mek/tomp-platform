-- 0033_one_active_qr_per_call_sign.sql
-- One crewed unit, one live QR.
--
-- 0032 moved the driver QR onto the Call Sign but left the door open: pressing
-- "create QR" from two different jobs of the same Call Sign produced two active
-- tokens with two different PINs. The driver's phone binds to one of them and
-- the other stays live — which is the duplicate-credential problem the whole
-- restructure set out to end, arriving through a different door.
--
-- 0032 already constrains one active *job* per Call Sign; this does the same
-- for the credential.

-- Any duplicates that predate the index lose to the newest token: it is the one
-- whose PIN the control room read out most recently, so it is the one the
-- driver is holding.
with ranked as (
  select id,
         row_number() over (
           partition by call_sign_id
           order by created_at desc, id desc
         ) as rn
  from public.driver_access_tokens
  where status = 'active' and call_sign_id is not null
)
update public.driver_access_tokens t
set status = 'revoked',
    metadata = coalesce(t.metadata, '{}'::jsonb)
      || jsonb_build_object('revokedReason', 'superseded_by_newer_call_sign_qr')
from ranked
where ranked.id = t.id and ranked.rn > 1;

create unique index if not exists driver_access_tokens_one_active_per_call_sign_idx
  on public.driver_access_tokens(call_sign_id)
  where call_sign_id is not null and status = 'active';

-- Same rule for the read-only observer credential. A stale tracking link is
-- less dangerous than a stale driver link, but it is still a live URL nobody
-- remembers issuing.
with ranked_observers as (
  select id,
         row_number() over (
           partition by call_sign_id
           order by created_at desc, id desc
         ) as rn
  from public.observer_access_tokens
  where status = 'active'
)
update public.observer_access_tokens t
set status = 'revoked',
    metadata = coalesce(t.metadata, '{}'::jsonb)
      || jsonb_build_object('revokedReason', 'superseded_by_newer_observer_link')
from ranked_observers
where ranked_observers.id = t.id and ranked_observers.rn > 1;

create unique index if not exists observer_access_tokens_one_active_per_call_sign_idx
  on public.observer_access_tokens(call_sign_id)
  where status = 'active';
