import Link from "next/link";
import type { Project } from "@tomp/types/domain";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function ProjectWorkspaceHeader({ project }: { project: Project | null }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Project Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{project?.projectName || "ไม่พบโครงการ"}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {project?.projectCode || "ยังไม่ระบุรหัส"} · {project?.startDate || "-"} ถึง {project?.endDate || "-"} · {project?.timezone || "Asia/Bangkok"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatStatusTh(project?.status || "planning")}</span>
            <EnvironmentBadge />
          </div>
        </div>
        {project ? (
          <Link className="rounded-md bg-operation px-4 py-3 text-sm font-semibold text-white" href={`/projects/${project.id}/assignments`}>
            เปิดบอร์ด Assignment
          </Link>
        ) : null}
      </div>
    </section>
  );
}
