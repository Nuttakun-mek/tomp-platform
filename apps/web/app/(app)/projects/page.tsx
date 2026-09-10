import Link from "next/link";
import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import { ProjectArchiveButton } from "@/components/projects/project-archive-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getProjects } from "@/lib/data/projects";
import { getViewerAccess } from "@/lib/auth/access";
import { formatStatusTh } from "@/lib/i18n/status-th";

interface ProjectsPageProps {
  searchParams?: Promise<{ archived?: string }>;
}

function formatDateTh(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = searchParams ? await searchParams : {};
  const showArchived = params.archived === "1";
  const { permissions, roleKeys } = await getViewerAccess();
  const canManage = permissions.includes("*") || roleKeys.includes("super_admin") || permissions.includes("project.update");
  const canCreate = permissions.includes("*") || permissions.includes("project.create");

  const all = await getProjects();
  const live = all.filter((p) => !["closed", "archived"].includes(p.status));
  const archived = all.filter((p) => p.status === "archived");
  const shown = showArchived ? archived : live;

  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-operation">พื้นที่ทำงาน</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">โครงการของคุณ</h1>
            <p className="mt-1 text-sm text-slate-600">แต่ละโครงการมีภารกิจ งาน คนขับ รถ QR และศูนย์ควบคุมแยกกัน · เลือกโครงการเพื่อเข้าไปทำงาน</p>
          </div>
          {canCreate ? (
            <Link href="/projects/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-operation px-4 py-2.5 text-sm font-semibold text-white hover:bg-operation-deep">
              <Plus className="h-4 w-4" /> สร้างโครงการ
            </Link>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <Link href="/projects" className={`rounded-full px-3 py-1.5 ${!showArchived ? "bg-operation text-white" : "border border-slate-300 bg-white text-slate-600"}`}>
          กำลังใช้งาน ({live.length})
        </Link>
        {archived.length || showArchived ? (
          <Link href="/projects?archived=1" className={`rounded-full px-3 py-1.5 ${showArchived ? "bg-slate-700 text-white" : "border border-slate-300 bg-white text-slate-600"}`}>
            เก็บถาวร ({archived.length})
          </Link>
        ) : null}
      </div>

      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((project) => (
            <article key={project.id} className="grid content-start gap-3 rounded-panel border border-border/80 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-operation">{project.projectCode}</p>
                <StatusBadge label={formatStatusTh(project.status)} tone={project.status === "published" || project.status === "operating" ? "ready" : "neutral"} />
              </div>
              <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{project.projectName}</h3>
              <p className="text-xs text-slate-500">
                {formatDateTh(project.startDate)} – {formatDateTh(project.endDate)} · {project.timezone}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-operation px-3 py-1.5 text-xs font-semibold text-white">
                  เข้าโครงการ <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {canManage ? <ProjectArchiveButton projectId={project.id} archived={project.status === "archived"} /> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-panel border border-dashed border-slate-300 bg-white p-8 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 font-semibold text-ink">{showArchived ? "ไม่มีโครงการที่เก็บถาวร" : "ยังไม่มีโครงการ"}</p>
          <p className="mt-1 text-sm text-slate-600">
            {showArchived ? "โครงการที่เก็บถาวรจะแสดงที่นี่" : canCreate ? "สร้างโครงการแรกเพื่อเริ่มจัดงาน" : "ยังไม่ได้รับมอบหมายให้เข้าโครงการใด ติดต่อผู้ดูแล"}
          </p>
        </div>
      )}


    </div>
  );
}
