import Link from "next/link";
import { PageHeader } from "@/components/page-header";

const checklist = [
  { title: "ตั้งค่าโครงการ", detail: "สร้างหรือเลือกโครงการสำหรับงานปฏิบัติการขนส่ง", href: "/projects" },
  { title: "เพิ่มภารกิจ", detail: "กำหนดภารกิจ จุดรับ จุดส่ง เวลา และข้อผูกพันด้านบริการ", href: "/projects/10000000-0000-4000-8000-000000000003" },
  { title: "จัดสรรรถและคนขับ", detail: "เชื่อมภารกิจ Call Sign รถ คนขับ และช่วงเวลาทำงาน", href: "/projects/10000000-0000-4000-8000-000000000003/assignments" },
  { title: "ส่ง QR ให้คนขับ", detail: "ใช้ลิงก์ QR ที่ผูกกับ Assignment สำหรับคนขับชั่วคราว", href: "/projects/10000000-0000-4000-8000-000000000003/assignments" },
  { title: "คนขับยืนยันความพร้อม", detail: "คนขับเปิดหน้าจาก QR และยืนยันชื่อ เบอร์ รถ GPS และรูปถ่าย", href: "/driver/demo-token" },
  { title: "ศูนย์ควบคุมตรวจสถานะ", detail: "ติดตามความพร้อม รายการที่ต้องติดตาม และสถานะ Realtime fallback", href: "/mission-control" },
  { title: "ตรวจ Timeline", detail: "ตรวจลำดับเหตุการณ์สำคัญโดยไม่มีปุ่มแก้ไขหรือลบ", href: "/mission-control" }
];

export default function PilotChecklistPage() {
  return (
    <>
      <PageHeader
        eyebrow="ทดสอบ Pilot"
        title="Checklist สำหรับทดสอบภายใน"
        description="ใช้หน้านี้เดิน flow แบบมีผู้ดูแล: สร้างโครงการ เพิ่มภารกิจ จัดสรรงาน ส่ง QR ให้คนขับ และตรวจ Mission Control"
      />
      <section className="grid gap-4 md:grid-cols-2">
        {checklist.map((item, index) => (
          <Link key={item.title} href={item.href} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-operation">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-operation text-sm font-semibold text-white">{index + 1}</span>
              <div>
                <h2 className="text-lg font-semibold text-ink">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
