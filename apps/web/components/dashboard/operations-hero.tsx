import Link from "next/link";
import { StatusDot } from "@/components/ui/status-dot";

export function OperationsHero({ projectCount, assignmentCount, gpsCount, followUpCount }: { projectCount: number; assignmentCount: number; gpsCount: number; followUpCount: number }) {
  return (
    <section className="command-panel-dark overflow-hidden rounded-[32px] text-white shadow-command">
      <div className="command-grid grid gap-7 p-6 lg:grid-cols-[1.22fr_0.78fr] lg:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-semibold text-emerald-100">
            <StatusDot tone="success" pulse />
            Internal Pilot กำลังทดสอบ
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight lg:text-5xl">ควบคุมการปฏิบัติการขนส่งจากภาพเดียว</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">
            ดูสถานะโครงการ งานที่จัดสรร ความพร้อม ความเสี่ยง และตำแหน่ง GPS ล่าสุด เพื่อให้ทีมปฏิบัติการตัดสินใจได้เร็วและมั่นใจขึ้น
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-operation-deep" href="/mission-control">
              เปิดศูนย์ควบคุม
            </Link>
            <Link className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15" href="/admin/pilot-smoke-test">
              ทดสอบ Pilot
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HeroMetric label="โครงการ" value={projectCount} />
          <HeroMetric label="งานที่จัดสรร" value={assignmentCount} />
          <HeroMetric label="GPS ล่าสุด" value={gpsCount} />
          <HeroMetric label="ต้องติดตาม" value={followUpCount} danger />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/10 p-5 backdrop-blur">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className={`mt-2 text-4xl font-semibold ${danger && value > 0 ? "text-amber-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
