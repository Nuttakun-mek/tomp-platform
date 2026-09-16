-- 0039_observer_link_one_active.sql
-- One live observer link per unit, and one per project.
--
-- 0033 gave the per-Call-Sign link a partial unique index. The project-wide
-- link arrived later in 0037 and never got a counterpart, so nothing below the
-- application stopped a project accumulating live customer links: by
-- 2026-09-15 one project held eight of them, issued within 100 seconds of each
-- other and every one already expired. The application has since learned to
-- revoke the previous link before issuing a new one; this is the guarantee
-- underneath that, for the next code path that forgets.
--
-- The per-Call-Sign index is rewritten here to skip NULL call_sign_id rows.
-- That is NOT a behaviour change — NULL is never equal to NULL, so the
-- project-scope rows were never constrained by it in the first place. It only
-- keeps the index off rows it can never speak for, and matches the shape
-- driver_access_tokens has carried since 0033.

-- A token past its expiry is not active, whatever the column says. Saying so
-- out loud is what releases the per-Call-Sign slot: a unit whose link had
-- expired could not be issued a new one, because the expired row still held
-- the only place in the unique index. That is the failure an operator saw as
-- the passenger QR simply refusing to generate.
update public.observer_access_tokens
set status = 'expired',
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('expiredBy', '0039_observer_link_one_active')
where status = 'active'
  and expires_at is not null
  and expires_at <= now();

-- Of whatever live project links remain, keep the newest: it is the one the
-- control room handed out most recently, so it is the one a customer holds.
with ranked as (
  select id,
         row_number() over (
           partition by project_id
           order by created_at desc, id desc
         ) as rn
  from public.observer_access_tokens
  where status = 'active' and scope = 'project'
)
update public.observer_access_tokens t
set status = 'revoked',
    metadata = coalesce(t.metadata, '{}'::jsonb)
      || jsonb_build_object('revokedReason', 'superseded_by_newer_observer_link')
from ranked
where ranked.id = t.id and ranked.rn > 1;

create unique index if not exists observer_access_tokens_one_active_per_project_idx
  on public.observer_access_tokens(project_id)
  where scope = 'project' and status = 'active';

drop index if exists public.observer_access_tokens_one_active_per_call_sign_idx;
create unique index if not exists observer_access_tokens_one_active_per_call_sign_idx
  on public.observer_access_tokens(call_sign_id)
  where call_sign_id is not null and status = 'active';
