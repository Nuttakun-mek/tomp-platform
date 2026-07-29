import { PilotSmokeTestPanel } from "@/components/admin/pilot-smoke-test-panel";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";

export default function PilotSmokeTestPage() {
  return (
    <>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="ตรวจระบบ Production Pilot"
        description="หน้านี้สำหรับผู้ดูแลระบบเพื่อตรวจ infrastructure แบบละเอียด หากต้องการทดสอบ flow ใช้งานจริงให้ใช้หน้า “ทดสอบระบบจบขั้นตอน”"
      />
      <section className="enterprise-panel-soft mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold text-ink">ต้องการทดสอบ flow ใช้งานจริง?</p>
          <p className="text-sm text-slate-600">ให้เริ่มจากหน้าเดียวที่สร้าง QR และพาไป Mission Control โดยตรง</p>
        </div>
        <Link className="rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm" href="/live-test">
          ไปหน้า ทดสอบระบบจบขั้นตอน
        </Link>
      </section>
      <PilotSmokeTestPanel />
    </>
  );
}
