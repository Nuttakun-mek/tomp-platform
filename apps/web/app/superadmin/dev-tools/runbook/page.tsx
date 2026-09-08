import { OperationsRunbookPanel } from "@/components/admin/operations-runbook-panel";
import { PageHeader } from "@/components/page-header";

export default function AdminOperationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="เครื่องมือพัฒนา"
        title="Runbook ดูแลระบบ"
        description="ขั้นตอนตรวจสุขภาพระบบ ทดสอบ GPS ตรวจข้อมูล และเปิดเหตุผิดปกติสำหรับทีมดูแลระบบ"
      />
      <OperationsRunbookPanel />
    </>
  );
}
