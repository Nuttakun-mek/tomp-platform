import type { Project } from "@tomp/types/domain";
import { ProjectSummaryCard } from "./project-summary-card";

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {projects.length ? (
        projects.map((project) => <ProjectSummaryCard key={project.id} project={project} />)
      ) : (
        <p className="rounded-card border border-slate-200 bg-white p-4 text-sm text-slate-600">ยังไม่มีโครงการ</p>
      )}
    </div>
  );
}
