import { LiveGpsTestPanel } from "@/components/live-test/live-gps-test-panel";
import { PageHeader } from "@/components/page-header";

export default function LiveTestPage() {
  return (
    <>
      <PageHeader
        eyebrow="ทดสอบ GPS สด"
        title="ทดสอบคนขับแชร์ตำแหน่งแบบเรียลไทม์"
        description="สร้างข้อมูลจริงสำหรับทดสอบ end-to-end: Assignment, QR คนขับ, การแชร์ GPS และ Mission Control"
      />
      <LiveGpsTestPanel />
    </>
  );
}
