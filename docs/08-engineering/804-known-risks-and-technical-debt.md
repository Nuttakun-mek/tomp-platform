# Known Risks and Technical Debt

- Temporary RLS policies are broad development placeholders.
- Production auth is not implemented.
- Live writes are not enabled beyond placeholder action architecture.
- Driver token security is placeholder-only.
- Mission Control is not realtime.
- Migrations have not been proven against a real local Supabase instance in this batch.
- End-to-end tests are not implemented.
- Supabase schema needs real migration and seed verification.
- npm audit reports moderate transitive dependency issues that currently require a breaking forced fix.
