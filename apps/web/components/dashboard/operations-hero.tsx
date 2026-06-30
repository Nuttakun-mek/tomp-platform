import Link from "next/link";
import { StatusDot } from "@/components/ui/status-dot";

export function OperationsHero({ projectCount, assignmentCount, gpsCount, followUpCount }: { projectCount: number; assignmentCount: number; gpsCount: number; followUpCount: number }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-slate-950 text-white shadow-command">
      <div className="command-grid grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            <StatusDot tone="success" pulse />
            Internal Pilot กำลังทดสอบ
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight lg:text-5xl">ภาพรวมการปฏิบัติการ</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
            มองภาพรวมโครงการ งานที่จัดสรร ความพร้อม ความเสี่ยง และตำแหน่ง GPS ล่าสุดในที่เดียว เพื่อให้ทีมปฏิบัติการรู้ว่าต้องตัดสินใจเรื่องใดก่อน
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-md bg-operation px-4 py-3 text-sm font-semibold text-white shadow-sm" href="/mission-control">
              เปิดศูนย์ควบคุม
            </Link>
            <Link className="rounded-md border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white" href="/live-test">
              ทดสอบ GPS สด
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
    <div className="rounded-md border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${danger && value > 0 ? "text-amber-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
