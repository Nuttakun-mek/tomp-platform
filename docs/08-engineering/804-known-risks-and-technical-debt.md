# Known Risks and Technical Debt

- RLS policies are improved but still need automated project-member tests.
- Production auth cookie/session hardening is incomplete.
- Live writes exist, but transaction boundaries need hardening.
- Driver token hashing and validation exist, but revocation management UI is deferred.
- Mission Control has realtime subscription foundation, but retry/dedupe/load behavior is not production-hardened.
- Migrations were proven against a hosted Supabase project, but local Supabase reset testing is still needed.
- End-to-end tests are not implemented.
- Supabase schema needs repeatable migration and seed verification in CI.
- npm audit reports moderate transitive dependency issues that currently require a breaking forced fix.
- Storage upload utilities exist, but evidence gallery, signed URLs, and retention policy are deferred.
- UI is ready for guided internal pilot, not unsupervised production operation.
