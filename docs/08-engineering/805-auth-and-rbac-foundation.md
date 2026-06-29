# Auth and RBAC Foundation

Sprint 10 prepares project-scoped access without implementing enterprise SSO.

## First Login Methods

Email and Google login are the first planned options because they are available in Supabase Auth and fit the zero-cost pilot strategy. Keycloak and enterprise SSO are deferred until real organization requirements justify the operational overhead.

## Current Auth Flow

- `/login` renders email login and Google OAuth actions.
- `/auth/callback` exchanges the Supabase callback code and returns the user to Projects.
- `AuthStatus` resolves the current Supabase user and linked profile when available.
- Development fallback remains explicit and must not be used as production authorization.

## Future Keycloak Option

Keycloak or another enterprise IdP can be added later through Supabase supported SSO/OIDC patterns. It is not implemented in the internal pilot.

## Project-Scoped RBAC

Access is designed around `profiles`, `roles`, `permissions`, `role_permissions`, `project_members`, and `user_role_assignments`.

Roles include `super_admin`, `organization_admin`, `project_manager`, `operation_manager`, `planner`, `dispatcher`, `coordinator`, `driver`, `organizer`, `customer_viewer`, and `vendor`.

Permissions include `project.read`, `project.create`, `project.update`, `project.publish`, `mission.read`, `mission.create`, `mission.update`, `assignment.read`, `assignment.create`, `assignment.update`, `driver.read`, `driver.update`, `vehicle.read`, `vehicle.update`, `timeline.read`, `timeline.create`, and `admin.manage_users`.

## RLS Strategy

Sprint 10 introduces project-member select policies for project-owned operational tables. These are transitional and must be tested against real Supabase Auth sessions before production.

## Risks

The app still has a development fallback user. Service-role usage is server-only but must be protected in deployment environments. Role enforcement exists in server actions but still needs automated RLS tests.

## Production Hardening Checklist

- Add cookie-aware SSR session handling.
- Create real profiles for authenticated users.
- Verify project memberships with RLS tests.
- Rotate keys after pilot setup if secrets were shared during configuration.
- Disable development fallback in production deployments.
