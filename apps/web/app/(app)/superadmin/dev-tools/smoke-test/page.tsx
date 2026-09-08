import Link from "next/link";
import { PilotSmokeTestPanel } from "@/components/admin/pilot-smoke-test-panel";
import { PageHeader } from "@/components/page-header";

export default function PilotSmokeTestPage() {
  return (
    <>
      <PageHeader
        eyebrow="เครื่องมือพัฒนา"
        title="ตรวจ infrastructure ของ Supabase"
        description="ตรวจตารางและ Postgres readiness แบบละเอียด หากต้องการทดสอบ flow ใช้งานจริงให้ใช้หน้า “ทดสอบ QR + GPS”"
      />
      <section className="enterprise-panel-soft mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold text-ink">ต้องการทดสอบ flow ใช้งานจริง?</p>
          <p className="text-sm text-slate-600">ให้เริ่มจากหน้าเดียวที่สร้าง QR และพาไป Mission Control โดยตรง</p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-panel bg-operation px-5 text-sm font-semibold text-white transition hover:bg-operation-deep"
          href="/superadmin/dev-tools/live-test"
        >
          ไปหน้า ทดสอบ QR + GPS
        </Link>
      </section>
      <PilotSmokeTestPanel />
    </>
  );
}
