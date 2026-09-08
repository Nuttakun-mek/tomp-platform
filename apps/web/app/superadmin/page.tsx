import Link from "next/link";
import { Users, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function SuperadminPage() {
  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="ศูนย์ควบคุมแพลตฟอร์ม"
        description="จัดการผู้ใช้และบทบาท และเปิดเครื่องมือพัฒนาสำหรับตรวจแต่ละฟังก์ชันของระบบ"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="smart-card p-5" href="/superadmin/users">
          <span className="grid h-11 w-11 place-items-center rounded-panel bg-command text-white">
            <Users className="h-5 w-5" />
          </span>
          <h2 className="card-title mt-4">ผู้ใช้และสิทธิ์</h2>
          <p className="section-description mt-1.5">เพิ่มผู้ใช้ กำหนดบทบาทระดับองค์กรและโครงการ</p>
        </Link>
        <Link className="smart-card p-5" href="/superadmin/dev-tools">
          <span className="grid h-11 w-11 place-items-center rounded-panel bg-command text-white">
            <Wrench className="h-5 w-5" />
          </span>
          <h2 className="card-title mt-4">เครื่องมือพัฒนา</h2>
          <p className="section-description mt-1.5">ทดสอบ QR/GPS, ตรวจ infrastructure, คุณภาพข้อมูล และความพร้อมระบบ</p>
        </Link>
      </div>
    </>
  );
}
