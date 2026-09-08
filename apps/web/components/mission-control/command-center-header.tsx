import { AlertTriangle, RadioTower, ShieldCheck } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import type { Project } from "@tomp/types/domain";

export function CommandCenterHeader({ project, liveCount, issueCount }: { project: Project; liveCount: number; issueCount: number }) {
  return (
    <section className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_28px_80px_rgba(12,34,52,0.28)]">
      <div className="command-grid p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.2em] text-teal-200">ศูนย์ควบคุมปฏิบัติการ</p>
            <h1 className="mt-3 max-w-4xl text-[28px] font-semibold leading-tight sm:text-[36px]">{project.projectName}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              {project.projectCode} · ติดตามงานที่จัดสรร ตำแหน่ง GPS รถ คนขับ Timeline และรายการที่ต้องตัดสินใจในจอเดียว
            </p>
          </div>

          <div className="grid min-w-[240px] gap-2">
            <StatusPill icon={RadioTower} tone="success" label={`คนขับส่ง GPS ${liveCount} รายการ`} />
            <StatusPill icon={AlertTriangle} tone={issueCount ? "warning" : "success"} label={`ต้องติดตาม ${issueCount} รายการ`} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <CommandSignal label="สถานะโครงการ" value="กำลังติดตาม" detail="แสดงข้อมูลล่าสุดจากโครงการที่เลือก" />
          <CommandSignal label="การตัดสินใจ" value={issueCount ? "ต้องตรวจ" : "ปกติ"} detail="เน้นรายการที่ต้องตามก่อนงานปกติ" />
          <CommandSignal label="ความพร้อม" value="Smart View" detail="จัดกลุ่มรถ งาน และ GPS ให้อ่านเร็ว" />
        </div>
      </div>
    </section>
  );
}

function StatusPill({ icon: Icon, tone, label }: { icon: typeof ShieldCheck; tone: "success" | "warning"; label: string }) {
  const className = tone === "success" ? "bg-emerald-400/14 text-emerald-100" : "bg-amber-400/16 text-amber-100";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${className}`}>
      <Icon className="h-4 w-4" />
      <StatusDot tone={tone} pulse={tone === "success"} />
      {label}
    </span>
  );
}

function CommandSignal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
      <p className="mt-1 text-[12px] leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
