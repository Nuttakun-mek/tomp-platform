import { DataQualityPanel } from "@/components/admin/data-quality-panel";
import { PageHeader } from "@/components/page-header";
import { getDataQualityReport } from "@/lib/admin/data-quality";

export default async function DataQualityPage() {
  const report = await getDataQualityReport();

  return (
    <>
      <PageHeader
        eyebrow="เครื่องมือพัฒนา"
        title="ตรวจคุณภาพข้อมูล"
        description="อ่านข้อมูลจาก Supabase เพื่อหาชื่อภาษาไทยเพี้ยน Assignment ไม่ครบ QR ที่ยังใช้ไม่ได้ และสถานะ GPS ก่อนทดสอบกับทีมจริง"
      />
      <DataQualityPanel report={report} />
    </>
  );
}
