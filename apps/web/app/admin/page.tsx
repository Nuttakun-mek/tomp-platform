import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function AdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="ตั้งค่าระบบ"
        description="พื้นที่สำหรับตรวจสถานะระบบ สิทธิ์การเข้าถึง และเครื่องมือทดสอบสำหรับ internal pilot"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-panel" href="/admin/pilot-smoke-test">
          <p className="text-sm font-semibold text-operation">Production Pilot</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">ทดสอบแกนระบบจริง</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">ตรวจ Supabase, สร้างชุดทดสอบ, เปิด QR คนขับ และดูผลใน Mission Control</p>
        </Link>
      </div>
    </>
  );
}
