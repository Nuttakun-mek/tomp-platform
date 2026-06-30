import Link from "next/link";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { ProjectList } from "@/components/projects/project-list";
import { getProjects } from "@/lib/data/projects";

export default async function ProjectsPage() {
  const projects = await getProjects();
  const active = projects.filter((project) => !["closed", "archived"].includes(project.status)).length;

  return (
    <>
      <section className="rounded-md border border-slate-200 bg-slate-950 p-6 text-white shadow-command">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Project Workspace</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">โครงการปฏิบัติการ</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">โครงการคือพื้นที่หลักสำหรับรวมภารกิจ งานที่จัดสรร ทรัพยากร Call Sign และ Timeline ของการปฏิบัติการขนส่ง</p>
          </div>
          <Link className="rounded-md bg-operation px-4 py-3 text-sm font-semibold text-white" href="/projects/new">
            สร้างโครงการใหม่
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="โครงการทั้งหมด" value={projects.length} />
          <Metric label="กำลังวางแผน" value={active} />
          <Metric label="ข้อมูลตัวอย่าง/Pilot" value={projects.length ? 1 : 0} />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
        <CreateProjectForm />
        <ProjectList projects={projects} />
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
