import { PageHeader } from "@/components/page-header";
import { RoleMatrix } from "@/components/superadmin/role-matrix";
import { EmptyState } from "@/components/ui/empty-state";
import { listRolePermissionMatrix } from "@/lib/superadmin/overview";

export default async function SuperadminRolesPage() {
  const { roles, permissions, grid } = await listRolePermissionMatrix();

  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="บทบาทและสิทธิ์"
        description="เมทริกซ์บทบาท × สิทธิ์ อ่านจากตาราง role_permissions ใน DB ซึ่งเป็น source of truth ของระบบ"
      />
      {roles.length ? (
        <RoleMatrix roles={roles} permissions={permissions} grid={grid} />
      ) : (
        <EmptyState title="ยังไม่มีข้อมูล role_permissions" description="รัน migration 0018_seed_role_permissions เพื่อ seed เมทริกซ์" />
      )}
    </>
  );
}
