import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function DriverPage() {
  return (
    <>
      <PageHeader
        eyebrow="หน้าคนขับ"
        title="เข้าถึงงานด้วย QR"
        description="ใช้สำหรับทดสอบการเปิดงานของคนขับแบบ assignment-scoped ใน Pilot ภายใน"
      />
      <Link className="inline-flex rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" href="/driver/demo-token">
        เปิดหน้าคนขับข้อมูลตัวอย่าง
      </Link>
    </>
  );
}
