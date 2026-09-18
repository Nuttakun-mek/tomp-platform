-- 0045_project_manage_members_permission.sql
-- docs/11-codex/984 "Granting access": fixes a dangling promise already in
-- project/page.tsx's SettingsView — the "เพิ่ม/จัดการผู้ใช้" link points at
-- /superadmin/users, which a project_manager viewing their own project could
-- never open.

insert into public.permissions (permission_key, permission_name, description) values
  ('project.manage_members', 'Manage project members', 'Add, remove, or change the role of a member on a specific project.')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.role_key = 'project_manager' and p.permission_key = 'project.manage_members'
on conflict (role_id, permission_id) do nothing;
