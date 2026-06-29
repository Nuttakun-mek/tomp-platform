# Internal Pilot Readiness Review

## Ready

- Core project, mission, assignment, resource, driver, and mission control pages.
- Supabase migrations and seed tested against a real hosted project.
- Server-side read path for Supabase data.
- Auth, RBAC, publish/change, token, storage, and realtime foundations.
- Professional UI shell and shared UI primitives.

## Not Ready

- Full production auth/session hardening.
- Automated RLS tests.
- Production QR revocation management.
- Evidence gallery and signed URL review.
- Realtime resilience and operational alerting.

## Go Criteria

- Pilot team can open app, view project, review assignments, open driver card, and monitor Mission Control.
- Secrets are stored only in local/Vercel environment variables.
- Team understands fallback and non-production boundaries.

## No-Go Criteria

- Service-role appears in browser bundle.
- Timeline can be edited or deleted from UI.
- Published plan can be directly modified without change request.

