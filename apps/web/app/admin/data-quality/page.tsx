import { DataQualityPanel } from "@/components/admin/data-quality-panel";
import { PageHeader } from "@/components/page-header";
import { getDataQualityReport } from "@/lib/admin/data-quality";

export default async function DataQualityPage() {
  const report = await getDataQualityReport();

  return (
    <>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="ตรวจคุณภาพข้อมูล Pilot"
        description="ตรวจข้อมูล live-test และ Supabase แบบอ่านอย่างเดียว เพื่อหาชื่อภาษาไทยเพี้ยน Assignment ไม่ครบ QR ที่ยังใช้ไม่ได้ และสถานะ GPS ก่อนทดสอบกับทีมจริง"
      />
      <DataQualityPanel report={report} />
    </>
  );
}
