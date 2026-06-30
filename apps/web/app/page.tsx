import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getLatestDriverLocations } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";

const operatingCycle = [
  { label: "วางแผน", detail: "สร้างโครงการ ภารกิจ และช่วงเวลาปฏิบัติการ" },
  { label: "เตรียมความพร้อม", detail: "ตรวจคนขับ รถ Call Sign และข้อมูลติดต่อ" },
  { label: "ประกาศใช้แผน", detail: "ตรึงแผนเป็น baseline และบันทึกลง Timeline" },
  { label: "ปฏิบัติการ", detail: "ติดตามสถานะ Assignment และตำแหน่ง GPS" },
  { label: "ปรับตัว", detail: "จัดการ change request เมื่อแผนถูกประกาศใช้แล้ว" },
  { label: "ทบทวนผล", detail: "ใช้ Timeline ตรวจสอบและปรับปรุงรอบถัดไป" }
];

export default async function DashboardPage() {
  const [projects, locations] = await Promise.all([getProjects(), getLatestDriverLocations(10)]);

  return (
    <>
      <PageHeader
        eyebrow="ภาพรวมการปฏิบัติการ"
        title="TOMP Internal Pilot"
        description="ทางเข้าเดียวสำหรับเจ้าหน้าที่วางแผน ศูนย์ควบคุม และการทดสอบคนขับผ่าน QR/GPS"
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Link className="rounded-md border border-blue-200 bg-blue-50 p-5 shadow-sm hover:border-blue-500" href="/mission-control">
          <p className="text-sm font-semibold text-blue-800">ศูนย์ควบคุม</p>
          <h2 className="mt-2 text-2xl font-semibold text-blue-950">ดูแผนที่และสถานะสด</h2>
          <p className="mt-2 text-sm leading-6 text-blue-900">ติดตามตำแหน่งคนขับจาก GPS, Timeline และรายการที่ต้องติดตาม</p>
        </Link>
        <Link className="rounded-md border border-teal-200 bg-teal-50 p-5 shadow-sm hover:border-teal-500" href="/projects">
          <p className="text-sm font-semibold text-teal-800">Planning</p>
          <h2 className="mt-2 text-2xl font-semibold text-teal-950">จัดการโครงการ</h2>
          <p className="mt-2 text-sm leading-6 text-teal-900">สร้าง Mission, Assignment, Call Sign และ QR สำหรับคนขับ</p>
        </Link>
        <Link className="rounded-md border border-amber-200 bg-amber-50 p-5 shadow-sm hover:border-amber-500" href="/pilot-checklist">
          <p className="text-sm font-semibold text-amber-800">Guided Pilot</p>
          <h2 className="mt-2 text-2xl font-semibold text-amber-950">เดิน flow ทดสอบ</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">ทำตาม checklist ตั้งแต่โครงการจนถึง GPS บน Mission Control</p>
        </Link>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-slate-500">โครงการ</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{projects.length}</p>
          <p className="mt-1 text-sm text-slate-600">รายการที่อ่านได้จาก Supabase หรือข้อมูลตัวอย่าง</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-slate-500">ตำแหน่ง GPS ล่าสุด</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{locations.length}</p>
          <p className="mt-1 text-sm text-slate-600">คนขับที่ส่งตำแหน่งเข้าระบบล่าสุด</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-slate-500">สถานะระบบ</p>
          <p className="mt-2 text-3xl font-semibold text-ink">Pilot</p>
          <p className="mt-1 text-sm text-slate-600">ยังไม่ใช่ production-ready auth/RBAC</p>
        </div>
      </section>

      <section className="mt-8 rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-operation">วงจรการดำเนินงาน</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Plan, Prepare, Operate, Adapt, Improve</h2>
          </div>
          <Link className="rounded-md border border-operation px-4 py-2 text-sm font-semibold text-operation" href="/login">
            ดูทางเข้าใช้งาน
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {operatingCycle.map((stage) => (
            <article key={stage.label} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-operation">{stage.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{stage.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
