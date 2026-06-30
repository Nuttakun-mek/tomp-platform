import Link from "next/link";
import type { Project } from "@tomp/types/domain";

export function ProjectSwitcher({ projects, activeProjectId }: { projects: Project[]; activeProjectId: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">โครงการที่กำลังติดตาม</p>
          <p className="mt-1 text-sm text-slate-600">เลือกพื้นที่ปฏิบัติการที่ต้องการดูในศูนย์ควบคุม</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {projects.slice(0, 8).map((project) => (
            <Link
              key={project.id}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                project.id === activeProjectId ? "border-operation bg-operation text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-operation hover:bg-teal-50"
              }`}
              href={`/mission-control?projectId=${project.id}`}
            >
              {project.projectCode}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
