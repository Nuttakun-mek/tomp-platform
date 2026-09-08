import Link from "next/link";
import { Activity, ClipboardList, DatabaseZap, Gauge, ListChecks, ServerCog, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const TOOLS = [
  { href: "/superadmin/dev-tools/live-test", label: "ทดสอบ QR + GPS", detail: "สร้าง Assignment จริง เปิด QR คนขับ แชร์ GPS จบในหน้าเดียว", icon: Activity },
  { href: "/superadmin/dev-tools/smoke-test", label: "ตรวจ infrastructure", detail: "ตรวจตาราง Supabase และ Postgres readiness แบบละเอียด", icon: ServerCog },
  { href: "/superadmin/dev-tools/data-quality", label: "คุณภาพข้อมูล", detail: "หาชื่อไทยเพี้ยน Assignment ไม่ครบ QR ที่ยังใช้ไม่ได้", icon: DatabaseZap },
  { href: "/superadmin/dev-tools/readiness", label: "ความพร้อม 12 แกน", detail: "สิ่งที่พร้อม สิ่งที่ต้อง harden ก่อน production", icon: Gauge },
  { href: "/superadmin/dev-tools/runbook", label: "Runbook ดูแลระบบ", detail: "ขั้นตอนตรวจสุขภาพระบบและรับมือเหตุผิดปกติ", icon: ListChecks },
  { href: "/superadmin/dev-tools/pilot-checklist", label: "Pilot checklist", detail: "ลำดับทดสอบ end-to-end ทีละบทบาท", icon: ClipboardList },
  { href: "/superadmin/dev-tools/purge-test-data", label: "ล้างข้อมูลทดสอบ", detail: "ลบข้อมูลที่เครื่องมือทดสอบสร้าง (smokeTest) ออกจากฐานข้อมูลจริง", icon: Trash2 }
];

export default function DevToolsPage() {
  return (
    <>
      <PageHeader
        eyebrow="เครื่องมือพัฒนา"
        title="เครื่องมือตรวจและทดสอบระบบ"
        description="ใช้พัฒนาและตรวจแต่ละฟังก์ชันของระบบ แยกจากงานจริงของผู้ใช้"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.href} className="smart-card p-5" href={tool.href}>
              <span className="grid h-10 w-10 place-items-center rounded-panel bg-command text-white">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="card-title mt-3.5">{tool.label}</h2>
              <p className="section-description mt-1.5">{tool.detail}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
