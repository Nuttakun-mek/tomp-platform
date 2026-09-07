import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Project } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

export function ProjectSummaryCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-operation hover:shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-operation">{project.projectCode}</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-ink">{project.projectName}</h2>
        </div>
        <StatusBadge label={formatStatusTh(project.status)} tone={project.status === "published" || project.status === "operating" ? "ready" : "neutral"} />
      </div>
      <p className="mt-3 text-sm text-slate-600">{project.startDate} ถึง {project.endDate} / {project.timezone}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-operation">
        เข้า Project Workspace
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
