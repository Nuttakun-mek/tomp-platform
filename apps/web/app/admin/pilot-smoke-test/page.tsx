import { PilotSmokeTestPanel } from "@/components/admin/pilot-smoke-test-panel";
import { PageHeader } from "@/components/page-header";

export default function PilotSmokeTestPage() {
  return (
    <>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="ทดสอบ Production Pilot"
        description="ตรวจ Supabase, ตาราง driver operations, QR, assignment packet, GPS session และ Mission Control ก่อนเริ่ม pilot จริง"
      />
      <PilotSmokeTestPanel />
    </>
  );
}
