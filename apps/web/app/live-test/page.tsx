import { LiveGpsTestPanel } from "@/components/live-test/live-gps-test-panel";
import { PageHeader } from "@/components/page-header";

export default function LiveTestPage() {
  return (
    <>
      <PageHeader
        eyebrow="ทดสอบระบบจบขั้นตอน"
        title="ทดสอบ QR คนขับและ GPS สด"
        description="เส้นทางหลักสำหรับ internal pilot: ตรวจระบบ สร้าง Assignment จริง เปิด QR คนขับ แชร์ GPS และดูผลในศูนย์ควบคุม"
      />
      <LiveGpsTestPanel />
    </>
  );
}
