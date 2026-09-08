import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Project } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStatusTh } from "@/lib/i18n/status-th";

function formatDateTh(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectSummaryCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="grid min-w-0 content-start gap-3 rounded-panel border border-border/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-operation/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-operation">{project.projectCode}</p>
        <StatusBadge
          label={formatStatusTh(project.status)}
          tone={project.status === "published" || project.status === "operating" ? "ready" : "neutral"}
        />
      </div>
      <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{project.projectName}</h3>
      <p className="meta-text">
        {formatDateTh(project.startDate)} – {formatDateTh(project.endDate)}
        <span className="mx-1.5 text-border">·</span>
        {project.timezone}
      </p>
      <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-operation">
        เข้า Project Workspace
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
