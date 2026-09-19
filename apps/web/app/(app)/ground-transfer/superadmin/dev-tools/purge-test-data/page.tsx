import { PageHeader } from "@/components/page-header";
import { PurgeTestDataPanel } from "@/components/superadmin/purge-test-data-panel";
import { countSmokeTestRows } from "@/lib/superadmin/purge-test-data";

export default async function PurgeTestDataPage() {
  const counts = await countSmokeTestRows();

  return (
    <>
      <PageHeader
        eyebrow="เครื่องมือพัฒนา"
        title="ล้างข้อมูลทดสอบ"
        description="เครื่องมือ live-test / smoke-test สร้างข้อมูลจริงในฐานข้อมูล (ติดแท็ก smokeTest) — ใช้หน้านี้ลบทิ้งเมื่อทดสอบเสร็จ"
      />
      <PurgeTestDataPanel counts={counts} />
    </>
  );
}
