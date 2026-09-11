-- The passenger QR could be issued but never shown again.
--
-- Both credentials on a unit's sheet were stored as a hash only, so the
-- plaintext existed for exactly as long as the browser tab did. Reload the page
-- and the QR was gone — not hidden, gone, because there was nothing left to draw
-- it from. Operators read that as a bug, and they were right to: a passenger
-- link that cannot be handed out twice is not much of a link.
--
-- The two credentials do not carry the same risk, so they are not treated the
-- same any more.
--
--   driver token   opens a job, posts GPS, accepts work, and is paired with a
--                  PIN. Stays hash-only. Someone reading this table must not
--                  come away with a working driver credential.
--
--   observer link  read-only. Shows a position and a destination. No PIN, no
--                  controls, nothing to act on. Held in the clear on purpose so
--                  it can be redrawn.
--
-- The operator-facing consequence is that the driver half is the only one that
-- needs reissuing, and reissuing invalidates whatever is already printed — so
-- the sheet has to say, before it is ever closed, that the driver QR and PIN are
-- shown once.

alter table public.observer_access_tokens
  add column if not exists token_plaintext text;

comment on column public.observer_access_tokens.token_plaintext is
  'The observer link in the clear, so the passenger QR can be redrawn after a reload. Deliberate: this token is read-only and carries no PIN. Driver tokens remain hash-only in driver_access_tokens.';

-- Rows issued before this migration have no plaintext and never will — the
-- value was never kept. Those units show the reissue path instead, which is
-- correct rather than a gap: there is genuinely nothing to redraw.
