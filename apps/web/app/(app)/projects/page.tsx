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
      <section className="command-panel-dark overflow-hidden text-white shadow-command">
        <div className="command-grid grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] lg:items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">ศูนย์รวมโครงการ</p>
            <h1 className="display-title mt-3 max-w-2xl text-white">เลือกโครงการเพื่อเริ่มปฏิบัติการ</h1>
            <p className="mt-3 max-w-xl text-[13px] leading-7 text-slate-300 sm:text-sm">
              โครงการคือพื้นที่ทำงานย่อยที่รวมภารกิจ งานที่จัดสรร คนขับ รถ QR, GPS และ Timeline ของรอบงานเดียวกัน
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link className="inline-flex min-h-11 items-center gap-2 rounded-panel bg-operation px-5 py-3 text-sm font-semibold text-white transition hover:bg-operation-deep" href="/projects/new">
                <Plus className="h-4 w-4" />
                สร้างโครงการใหม่
              </Link>
              <Link className="inline-flex min-h-11 items-center gap-2 rounded-panel border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15" href="/mission-control">
                เปิดศูนย์ควบคุม
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
            <Metric label="โครงการทั้งหมด" value={projects.length} />
            <Metric label="กำลังใช้งาน" value={active} />
            <Metric label="ประกาศใช้แล้ว" value={published} />
          </div>
        </div>
      </section>

      <section className="enterprise-panel grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-label">พื้นที่โครงการ</p>
            <h2 className="section-title mt-1">โครงการที่พร้อมเข้าใช้งาน</h2>
            <p className="section-description mt-1">กดการ์ดโครงการเพื่อเข้าไปจัดภารกิจ รถ คนขับ Assignment, QR และ Timeline</p>
          </div>
          <FolderKanban className="h-7 w-7 shrink-0 text-operation" />
        </div>
        <ProjectList projects={projects} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:items-start">
        <CreateProjectForm />
        <section className="enterprise-panel grid content-start gap-4 p-5">
          <div>
            <p className="section-label">โครงสร้างการเข้าใช้งาน</p>
            <h2 className="section-title mt-1">ลำดับงานที่แนะนำ</h2>
          </div>
          <ol className="grid gap-3 text-sm text-slate-700">
            {["สร้างหรือเลือกโครงการ", "เพิ่มภารกิจ", "จัดสรรรถและคนขับ", "สร้าง QR ให้คนขับ", "ติดตาม GPS และสถานะในศูนย์ควบคุม"].map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-card border border-slate-200 bg-slate-50 p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-command text-xs font-semibold text-white">{index + 1}</span>
                <span className="min-w-0 font-medium">{step}</span>
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
    <div className="rounded-card border border-white/10 bg-white/[0.07] p-4">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="mt-2 text-[26px] font-semibold leading-none text-white [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  );
}
