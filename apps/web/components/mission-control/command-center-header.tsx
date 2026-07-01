import { StatusDot } from "@/components/ui/status-dot";
import type { Project } from "@tomp/types/domain";

export function CommandCenterHeader({ project, liveCount, issueCount }: { project: Project; liveCount: number; issueCount: number }) {
  return (
    <section className="command-panel-dark overflow-hidden rounded-[32px] text-white shadow-command">
      <div className="command-grid p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-teal-200">Mission Control / ศูนย์ควบคุมปฏิบัติการ</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight lg:text-4xl">{project.projectName}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{project.projectCode} · ติดตามงานที่จัดสรร GPS Timeline และรายการที่ต้องตัดสินใจ</p>
          </div>
          <div className="grid gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1 font-semibold text-emerald-100">
              <StatusDot tone="success" pulse />
              คนขับส่ง GPS {liveCount} รายการ
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 font-semibold text-amber-100">
              <StatusDot tone={issueCount ? "warning" : "success"} />
              ต้องติดตาม {issueCount} รายการ
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
