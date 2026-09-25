import { PageHeader } from "@/components/page-header";
import { AppleReviewDemoPanel } from "@/components/superadmin/apple-review-demo-panel";
import { getAppleReviewDemoStatusAction, type AppleReviewDemoStatus } from "@/app/actions/apple-review-demo";

export default async function AppleReviewDemoPage() {
  const result = await getAppleReviewDemoStatusAction();
  const status = (result.success ? (result.data as AppleReviewDemoStatus) : { exists: false }) satisfies AppleReviewDemoStatus;

  return (
    <>
      <PageHeader
        eyebrow="เครื่องมือพัฒนา"
        title="งานสาธิตสำหรับ Apple App Review"
        description="QR ถาวรที่ผู้ตรวจของ Apple ใช้เปิดงานจริงได้ครบทุกฟังก์ชัน — โครงการนี้แสดงในรายการโครงการพร้อมป้าย “ทดสอบ Apple” เพื่อติดตามงานระหว่างรอรีวิว"
      />
      <AppleReviewDemoPanel status={status} />
    </>
  );
}
