-- 0049_global_project_manager_role.sql
-- No schema change. Records the decision that closed the audit item "an
-- account that isn't super_admin but can create projects doesn't really
-- work": project_manager already carries project.create in ROLE_PERMISSIONS
-- and create_project_command() (0047) already auto-grants the creator
-- project-scoped project_manager on whatever they create — the only gap was
-- a UI path to grant project_manager as a GLOBAL role (user_role_assignments,
-- project_id null). apps/web/components/superadmin/invite-user-form.tsx now
-- offers this directly. No new role, no new table, no new RPC needed.
insert into public.roles (role_key, role_name, description)
values ('project_manager', 'Project Manager', 'Project-scoped or, with a global grant, platform-wide project creation and management.')
on conflict (role_key) do nothing;
