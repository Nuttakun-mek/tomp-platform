-- Seed role_permissions from the app's ROLE_PERMISSIONS matrix so the DB is the
-- source of truth. Idempotent. super_admin uses a wildcard sentinel permission.

insert into public.permissions (permission_key, permission_name)
values
  ('project.create', 'Create projects'),
  ('mission.create', 'Create missions'),
  ('mission.update', 'Update missions'),
  ('assignment.create', 'Create assignments'),
  ('driver.create', 'Create drivers'),
  ('vehicle.create', 'Create vehicles'),
  ('change.create', 'Create change requests'),
  ('change.approve', 'Approve change requests'),
  ('change.apply', 'Apply change requests'),
  ('incident.create', 'Create incidents'),
  ('incident.manage', 'Manage incidents'),
  ('recovery.manage', 'Manage recovery'),
  ('org.manage', 'Manage organization settings'),
  ('superadmin.access', 'Access superadmin area'),
  ('*', 'All permissions (wildcard)')
on conflict (permission_key) do nothing;

-- role_key -> [permission_key]
with matrix(role_key, permission_key) as (
  values
    ('super_admin', '*'),
    ('organization_admin', 'project.read'), ('organization_admin', 'project.create'),
    ('organization_admin', 'project.update'), ('organization_admin', 'mission.read'),
    ('organization_admin', 'assignment.read'), ('organization_admin', 'timeline.read'),
    ('organization_admin', 'admin.manage_users'), ('organization_admin', 'org.manage'),
    ('project_manager', 'project.read'), ('project_manager', 'project.create'),
    ('project_manager', 'project.update'), ('project_manager', 'project.publish'),
    ('project_manager', 'mission.read'), ('project_manager', 'mission.create'),
    ('project_manager', 'mission.update'), ('project_manager', 'assignment.read'),
    ('project_manager', 'assignment.create'), ('project_manager', 'assignment.update'),
    ('project_manager', 'driver.read'), ('project_manager', 'driver.create'),
    ('project_manager', 'driver.update'), ('project_manager', 'vehicle.read'),
    ('project_manager', 'vehicle.create'), ('project_manager', 'vehicle.update'),
    ('project_manager', 'timeline.read'), ('project_manager', 'timeline.create'),
    ('project_manager', 'change.create'), ('project_manager', 'change.approve'),
    ('project_manager', 'change.apply'), ('project_manager', 'incident.create'),
    ('project_manager', 'incident.manage'), ('project_manager', 'recovery.manage'),
    ('operation_manager', 'project.read'), ('operation_manager', 'mission.read'),
    ('operation_manager', 'assignment.read'), ('operation_manager', 'assignment.update'),
    ('operation_manager', 'driver.read'), ('operation_manager', 'driver.update'),
    ('operation_manager', 'vehicle.read'), ('operation_manager', 'vehicle.update'),
    ('operation_manager', 'timeline.read'), ('operation_manager', 'timeline.create'),
    ('operation_manager', 'change.create'), ('operation_manager', 'change.apply'),
    ('operation_manager', 'incident.create'), ('operation_manager', 'incident.manage'),
    ('operation_manager', 'recovery.manage'),
    ('planner', 'project.read'), ('planner', 'mission.read'), ('planner', 'mission.create'),
    ('planner', 'mission.update'), ('planner', 'assignment.read'), ('planner', 'assignment.create'),
    ('dispatcher', 'project.read'), ('dispatcher', 'mission.read'), ('dispatcher', 'assignment.read'),
    ('dispatcher', 'assignment.create'), ('dispatcher', 'assignment.update'),
    ('dispatcher', 'driver.read'), ('dispatcher', 'driver.create'),
    ('dispatcher', 'vehicle.read'), ('dispatcher', 'vehicle.create'),
    ('coordinator', 'project.read'), ('coordinator', 'mission.read'),
    ('coordinator', 'assignment.read'), ('coordinator', 'timeline.read'),
    ('coordinator', 'incident.create'),
    ('driver', 'assignment.read'),
    ('organizer', 'project.read'), ('organizer', 'mission.read'), ('organizer', 'timeline.read'),
    ('organizer', 'change.create'),
    ('customer_viewer', 'project.read'), ('customer_viewer', 'timeline.read'),
    ('vendor', 'assignment.read'), ('vendor', 'driver.read'), ('vendor', 'vehicle.read')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.roles r on r.role_key = m.role_key
join public.permissions p on p.permission_key = m.permission_key
on conflict (role_id, permission_id) do nothing;
