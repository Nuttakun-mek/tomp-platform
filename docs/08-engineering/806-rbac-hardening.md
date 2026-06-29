# RBAC Hardening

Sprint 16 moves RBAC from design toward enforced server-side checks.

## Implemented

- Permission helpers for project read/create/publish, mission create, assignment create, and timeline create.
- Server actions perform permission checks and return action errors when unauthorized.
- Development fallback remains explicit and must not be treated as production authorization.
- Additive migration `0007_rbac_hardening.sql` documents narrower insert policies for missions and assignments.

## Remaining Work

- Verify RLS with real Supabase Auth sessions.
- Replace fallback development user with cookie-aware production session handling.
- Add automated RLS tests using seeded users and memberships.

