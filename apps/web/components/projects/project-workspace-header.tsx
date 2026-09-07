import Link from "next/link";
import { ClipboardList, MapPinned } from "lucide-react";
import type { Project } from "@tomp/types/domain";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { Badge } from "@/components/ui/badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function ProjectWorkspaceHeader({ project }: { project: Project | null }) {
  return (
    <section className="enterprise-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="page-kicker">Project Workspace</p>
          <h1 className="mt-2 page-title">{project?.projectName || "ไม่พบโครงการ"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {project?.projectCode || "ยังไม่ระบุรหัส"} / {project?.startDate || "-"} ถึง {project?.endDate || "-"} / {project?.timezone || "Asia/Bangkok"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge label={formatStatusTh(project?.status || "planning")} tone={project?.status === "published" || project?.status === "operating" ? "success" : "info"} />
            <EnvironmentBadge />
          </div>
        </div>
        {project ? (
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex items-center gap-2 rounded-2xl bg-operation px-4 py-3 text-sm font-semibold text-white" href={`/projects/${project.id}/assignments`}>
              <ClipboardList className="h-4 w-4" />
              เปิดบอร์ด Assignment
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-operation hover:text-operation" href={`/mission-control?projectId=${project.id}`}>
              <MapPinned className="h-4 w-4" />
              ดูบนแผนที่
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
