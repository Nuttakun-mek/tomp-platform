import type { Project } from "@tomp/types/domain";
import { ProjectSummaryCard } from "./project-summary-card";

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Project List</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Read-only Supabase data when configured, demo fallback otherwise.</p>
      </div>
      <div className="grid gap-3">
        {projects.map((project) => <ProjectSummaryCard key={project.id} project={project} />)}
      </div>
    </section>
  );
}
