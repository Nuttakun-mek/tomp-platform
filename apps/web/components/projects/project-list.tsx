import type { Project } from "@tomp/types/domain";
import { ProjectSummaryCard } from "./project-summary-card";

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">รายการโครงการ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">แสดงข้อมูลจาก Supabase เมื่อกำหนดค่าแล้ว หรือแสดงข้อมูลตัวอย่างเมื่อยังไม่เชื่อมต่อ</p>
      </div>
      <div className="grid gap-3">
        {projects.length ? projects.map((project) => <ProjectSummaryCard key={project.id} project={project} />) : <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">ยังไม่มีโครงการ</p>}
      </div>
    </section>
  );
}
