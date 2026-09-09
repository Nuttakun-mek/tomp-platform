import Link from "next/link";
import { ShieldCheck, Users, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function SuperadminPage() {
  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="ศูนย์ควบคุมแพลตฟอร์ม"
        description="ผู้ใช้ สิทธิ์ และเครื่องมือแพลตฟอร์มทั้งหมดอยู่ในหน้านี้"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Link className="smart-card" href="/superadmin/users">
          <span className="grid h-10 w-10 place-items-center rounded-panel bg-command text-white">
            <Users className="h-5 w-5" />
          </span>
          <h2 className="card-title mt-3">ผู้ใช้และสิทธิ์</h2>
          <p className="section-description mt-1">เพิ่มผู้ใช้ และกำหนดบทบาทในแต่ละโครงการ</p>
        </Link>
        <Link className="smart-card" href="/superadmin/roles">
          <span className="grid h-10 w-10 place-items-center rounded-panel bg-command text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h2 className="card-title mt-3">บทบาทและสิทธิ์</h2>
          <p className="section-description mt-1">ดูว่าแต่ละบทบาททำอะไรได้บ้าง ก่อนมอบหมายให้ผู้ใช้</p>
        </Link>
        <Link className="smart-card" href="/superadmin/dev-tools">
          <span className="grid h-10 w-10 place-items-center rounded-panel bg-command text-white">
            <Wrench className="h-5 w-5" />
          </span>
          <h2 className="card-title mt-3">เครื่องมือพัฒนา</h2>
          <p className="section-description mt-1">ทดสอบ QR/GPS, ตรวจ infrastructure, คุณภาพข้อมูล และความพร้อมระบบ</p>
        </Link>
      </div>
    </>
  );
}
