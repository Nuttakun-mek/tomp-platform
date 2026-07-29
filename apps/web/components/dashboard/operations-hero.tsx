import Link from "next/link";
import { ArrowRight, RadioTower } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";

export function OperationsHero({ projectCount, assignmentCount, gpsCount, followUpCount }: { projectCount: number; assignmentCount: number; gpsCount: number; followUpCount: number }) {
  return (
    <section className="command-panel-dark overflow-hidden rounded-3xl text-white shadow-command">
      <div className="command-grid grid gap-5 p-5 lg:grid-cols-[1.15fr_0.85fr] lg:p-6">
        <div className="flex min-w-0 flex-col justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-100">
              <StatusDot tone="success" pulse />
              Internal Pilot พร้อมตรวจระบบ
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight md:text-[30px] lg:text-[34px]">
              ควบคุมการปฏิบัติการขนส่งจากภาพเดียว
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
              ดูโครงการ งานที่จัดสรร ความพร้อม ความเสี่ยง และตำแหน่ง GPS ล่าสุด เพื่อให้ทีมปฏิบัติการตัดสินใจได้เร็วและมั่นใจขึ้น
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex items-center gap-2 rounded-xl bg-operation px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-operation-deep" href="/mission-control">
              เปิดศูนย์ควบคุม
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15" href="/live-test">
              <RadioTower className="h-4 w-4" />
              ทดสอบ QR และ GPS
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
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-[12px] font-semibold text-slate-300">{label}</p>
      <p className={`mt-2 text-2xl font-semibold leading-none md:text-[28px] ${danger && value > 0 ? "text-amber-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
