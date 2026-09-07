import Link from "next/link";
import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { ProjectList } from "@/components/projects/project-list";
import { getProjects } from "@/lib/data/projects";

export default async function ProjectsPage() {
  const projects = await getProjects();
  const active = projects.filter((project) => !["closed", "archived"].includes(project.status)).length;
  const published = projects.filter((project) => project.status === "published" || project.status === "operating").length;

  return (
    <>
      <section className="command-panel-dark rounded-3xl p-6 text-white shadow-command">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-teal-200">ศูนย์รวมโครงการ</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-[38px]">เลือกโครงการเพื่อเริ่มปฏิบัติการ</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
              โครงการคือพื้นที่ทำงานย่อยที่รวมภารกิจ งานที่จัดสรร คนขับ รถ QR, GPS และ Timeline ของรอบงานเดียวกัน
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="inline-flex items-center gap-2 rounded-2xl bg-operation px-5 py-3 text-sm font-semibold text-white" href="/projects/new">
                <Plus className="h-4 w-4" />
                สร้างโครงการใหม่
              </Link>
              <Link className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white" href="/mission-control">
                เปิดศูนย์ควบคุม
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="grid min-w-[260px] gap-3">
            <Metric label="โครงการทั้งหมด" value={projects.length} />
            <Metric label="กำลังใช้งาน" value={active} />
            <Metric label="ประกาศใช้แล้ว" value={published} />
          </div>
        </div>
      </section>

      <section className="enterprise-panel grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="page-kicker">Project Workspace</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">โครงการที่พร้อมเข้าใช้งาน</h2>
            <p className="mt-1 text-sm text-slate-600">กดการ์ดโครงการเพื่อเข้าไปจัดภารกิจ รถ คนขับ Assignment, QR และ Timeline</p>
          </div>
          <FolderKanban className="h-8 w-8 text-operation" />
        </div>
        <ProjectList projects={projects} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateProjectForm />
        <section className="enterprise-panel grid content-start gap-4 p-5">
          <p className="page-kicker">โครงสร้างการเข้าใช้งาน</p>
          <h2 className="text-xl font-semibold text-ink">ลำดับงานที่แนะนำ</h2>
          <ol className="grid gap-3 text-sm text-slate-700">
            {["สร้างหรือเลือกโครงการ", "เพิ่มภารกิจ", "จัดสรรรถและคนขับ", "สร้าง QR ให้คนขับ", "ติดตาม GPS และสถานะในศูนย์ควบคุม"].map((step, index) => (
              <li key={step} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-semibold text-white">{index + 1}</span>
                <span className="font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none text-white">{value}</p>
    </div>
  );
}
