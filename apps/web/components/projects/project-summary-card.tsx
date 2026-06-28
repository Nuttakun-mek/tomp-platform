import Link from "next/link";
import type { Project } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";

export function ProjectSummaryCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="block rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-operation">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-operation">{project.projectCode}</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{project.projectName}</h2>
        </div>
        <StatusBadge label={project.status} tone={project.status === "published" ? "ready" : "neutral"} />
      </div>
      <p className="mt-3 text-sm text-slate-600">{project.startDate} to {project.endDate} / {project.timezone}</p>
    </Link>
  );
}
