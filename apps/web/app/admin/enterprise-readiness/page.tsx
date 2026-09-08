import { PermissionGate } from "@/components/auth/permission-gate";
import { EnterpriseReadinessPanel } from "@/components/admin/enterprise-readiness-panel";
import { PageHeader } from "@/components/page-header";

export default function EnterpriseReadinessPage() {
  return (
    <PermissionGate anyRole={["super_admin"]}>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="ความพร้อมระดับ Enterprise"
        description="ตรวจภาพรวม 12 แกนสำคัญของ TOMP ก่อนขยายจาก internal pilot ไปสู่ production enterprise"
      />
      <EnterpriseReadinessPanel />
    </PermissionGate>
  );
}
