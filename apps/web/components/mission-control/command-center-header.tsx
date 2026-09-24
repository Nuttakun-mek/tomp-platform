import { AlertTriangle, RadioTower, ShieldCheck } from "lucide-react";
import { StatusDot } from "@/components/ui/status-dot";
import type { Project } from "@tomp/types/domain";

// One row: which project, and the two live counts. It used to be a ~300px hero
// with three tiles of fixed text ("Smart View", "กำลังติดตาม") that never changed,
// directly above a KPI strip carrying the real numbers.
export function CommandCenterHeader({ project, liveCount, issueCount }: { project: Project; liveCount: number; issueCount: number }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-slate-950 px-4 py-3 text-white shadow-command">
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.2em] text-teal-200">ศูนย์ควบคุมปฏิบัติการ · {project.projectCode}</p>
        <h1 className="truncate text-lg font-semibold leading-snug sm:text-xl">{project.projectName}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusPill icon={RadioTower} tone="success" label={`คนขับส่ง GPS ${liveCount} รายการ`} />
        <StatusPill icon={AlertTriangle} tone={issueCount ? "warning" : "success"} label={`ต้องติดตาม ${issueCount} รายการ`} />
      </div>
    </section>
  );
}

function StatusPill({ icon: Icon, tone, label }: { icon: typeof ShieldCheck; tone: "success" | "warning"; label: string }) {
  const className = tone === "success" ? "bg-emerald-400/14 text-emerald-100" : "bg-amber-400/16 text-amber-100";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${className}`}>
      <Icon className="h-4 w-4" />
      <StatusDot tone={tone} pulse={tone === "success"} />
      {label}
    </span>
  );
}
