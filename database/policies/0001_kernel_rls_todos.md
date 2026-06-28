# Kernel RLS Policy TODOs

Sprint 1 Hardening intentionally keeps RBAC lightweight. RLS is enabled in `database/migrations/0001_initial_kernel.sql`, but production policies should be added only after auth, membership, and scoped access rules are confirmed.

## Authenticated Read Scope

Goal: authenticated users can read records in their own organization and project scope.

Concept:

- Resolve the current profile through `profiles.auth_user_id = auth.uid()`.
- Allow organization reads where `organizations.id = profiles.organization_id`.
- Allow project reads where `projects.organization_id = profiles.organization_id`.
- Allow child table reads through the parent project organization.

Example shape to refine later:

```sql
create policy "profiles can read own organization projects"
on public.projects
for select
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where auth_user_id = (select auth.uid())
      and deleted_at is null
  )
);
```

## Service Role Full Access

The Supabase service role bypasses RLS and must never be exposed to browser code. Server-only operational scripts may use service-role credentials for migrations, imports, and controlled back-office jobs.

Document any service-role usage before implementation.

## Timeline Insert Policy Concept

Timeline events are immutable. Inserts should be allowed only when the actor is scoped to the project, or when a trusted server process records system events.

Concept:

- Operation users insert timeline events for projects in their organization scope.
- Driver QR access inserts only scoped driver events after token validation.
- System/server insertions use a server-only path.
- Updates and deletes remain blocked by the immutable trigger.

## Data API Grants

Supabase may not expose new SQL-created tables to the Data API automatically depending on project settings. When exposing a table, pair explicit `GRANT` statements with RLS policies. Do not grant broad `anon` access to operational tables.
