-- 0024_rbac_v3_operator_permission_topup.sql
-- ---------------------------------------------------------------------------
-- Forward-only. 0021 trimmed role_permissions to a minimal 2-tier matrix, but
-- the application still routes driver/vehicle creation, incident reporting and
-- change approval through requirePermission() with project-scoped keys. Before
-- this migration those only worked because server actions bypassed the check in
-- service-role mode (removed in code). Grant the operator roles what their
-- day-to-day workflow actually needs so RBAC can be enforced for real.
--
-- Keeps in step with apps/web/lib/auth/permissions.ts ROLE_PERMISSIONS.
-- ---------------------------------------------------------------------------

-- Ensure the permission keys exist (0021 did not touch the permissions table).
insert into public.permissions (permission_key, permission_name, description)
values
  ('driver.create', 'Create driver', 'สร้างข้อมูลคนขับ'),
  ('vehicle.create', 'Create vehicle', 'สร้างข้อมูลรถ'),
  ('timeline.create', 'Append timeline event', 'บันทึกเหตุการณ์ Timeline'),
  ('change.approve', 'Approve change request', 'อนุมัติคำขอเปลี่ยนแปลง'),
  ('change.apply', 'Apply change request', 'ปรับใช้คำขอเปลี่ยนแปลง')
on conflict (permission_key) do nothing;

with matrix(role_key, permission_key) as (
  values
    ('project_manager', 'driver.create'), ('project_manager', 'vehicle.create'),
    ('project_manager', 'timeline.create'), ('project_manager', 'change.approve'),
    ('project_manager', 'change.apply'),

    ('dispatcher', 'driver.create'), ('dispatcher', 'vehicle.create'),
    ('dispatcher', 'timeline.create'),

    ('coordinator', 'timeline.create')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.roles r on r.role_key = m.role_key
join public.permissions p on p.permission_key = m.permission_key
on conflict (role_id, permission_id) do nothing;
