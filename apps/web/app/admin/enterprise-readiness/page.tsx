import { EnterpriseReadinessPanel } from "@/components/admin/enterprise-readiness-panel";
import { PageHeader } from "@/components/page-header";

export default function EnterpriseReadinessPage() {
  return (
    <>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="ความพร้อมระดับ Enterprise"
        description="ตรวจภาพรวม 12 แกนสำคัญของ TOMP ก่อนขยายจาก internal pilot ไปสู่ production enterprise"
      />
      <EnterpriseReadinessPanel />
    </>
  );
}
