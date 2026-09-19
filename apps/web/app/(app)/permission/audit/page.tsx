import { PageHeader } from "@/components/page-header";
import { AuditFeed } from "@/components/superadmin/audit-feed";
import { listRecentAuditEvents } from "@/lib/superadmin/overview";

export default async function SuperadminAuditPage() {
  const rows = await listRecentAuditEvents(100);

  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="บันทึกกิจกรรม"
        description="ไทม์ไลน์กิจกรรมล่าสุด 100 รายการ ข้ามทุกโครงการในระบบ"
      />
      <AuditFeed rows={rows} />
    </>
  );
}
