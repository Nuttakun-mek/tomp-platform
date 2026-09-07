import Link from "next/link";
import { ArrowRight, MapPinned, RadioTower, ShieldCheck } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";

export function OperationsHero({ projectCount, assignmentCount, gpsCount, followUpCount }: { projectCount: number; assignmentCount: number; gpsCount: number; followUpCount: number }) {
  return (
    <section className="command-panel-dark overflow-hidden text-white shadow-command">
      <div className="command-grid grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="relative min-w-0 p-6 sm:p-7 lg:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/70 to-transparent" />
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-100">
            <StatusDot tone="success" pulse />
            ระบบทดสอบภายในพร้อมตรวจงาน
          </div>

          <h2 className="display-title mt-4 max-w-xl text-white">ควบคุมปฏิบัติการขนส่งจากภาพเดียว</h2>
          <p className="mt-3 max-w-lg text-[13px] leading-7 text-slate-300 sm:text-sm">
            เห็นโครงการ งานที่จัดสรร รถ คนขับ ความพร้อม สัญญาณ GPS และรายการที่ต้องตัดสินใจในพื้นที่เดียว เพื่อให้ทีมปฏิบัติการทำงานเร็วขึ้นและมั่นใจขึ้น
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-panel bg-operation px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(8,123,115,0.35)] transition hover:bg-operation-deep" href="/mission-control">
              เปิดศูนย์ควบคุม
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-panel border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15" href="/live-test">
              <RadioTower className="h-4 w-4" />
              ทดสอบ QR และ GPS
            </Link>
          </div>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
            <Signal label="แผนงาน" value="วางแผน" detail="โครงการและภารกิจ" />
            <Signal label="เตรียมพร้อม" value="พร้อมใช้" detail="รถ คนขับ และ QR" />
            <Signal label="ปฏิบัติการ" value="ติดตามสด" detail="GPS และ Timeline" />
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[0.05] p-5 backdrop-blur lg:border-l lg:border-t-0 lg:p-6">
          <div className="grid gap-2.5">
            <HeroMetric icon={ShieldCheck} label="โครงการ" value={projectCount} detail="พื้นที่ปฏิบัติการ" />
            <HeroMetric icon={MapPinned} label="งานที่จัดสรร" value={assignmentCount} detail="งานที่มอบให้รถและคนขับ" />
            <HeroMetric icon={RadioTower} label="GPS ล่าสุด" value={gpsCount} detail="สัญญาณที่ส่งเข้าศูนย์ควบคุม" />
            <HeroMetric icon={ArrowRight} label="ต้องติดตาม" value={followUpCount} detail="งานหรือสัญญาณที่ควรตรวจ" danger />
          </div>
        </div>
      </div>
    </section>
  );
}

function Signal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-card border border-white/10 bg-white/[0.05] p-3">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-[12px] text-slate-400">{detail}</p>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value, detail, danger = false }: { icon: typeof ShieldCheck; label: string; value: number; detail: string; danger?: boolean }) {
  return (
    <div className="rounded-card border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-300">{label}</p>
          <p className={`mt-1.5 text-[28px] font-semibold leading-none [font-variant-numeric:tabular-nums] ${danger && value > 0 ? "text-amber-200" : "text-white"}`}>{value}</p>
          <p className="mt-1.5 text-[12px] leading-5 text-slate-400">{detail}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-white/10 text-teal-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
