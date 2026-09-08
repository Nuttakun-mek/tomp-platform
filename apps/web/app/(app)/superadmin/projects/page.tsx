import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { listAllProjects } from "@/lib/superadmin/overview";

export default async function SuperadminProjectsPage() {
  const projects = await listAllProjects();

  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="โครงการทั้งหมด"
        description="โครงการทั้งหมดในระบบ พร้อมเจ้าของ สถานะ และจำนวนสมาชิก"
      />
      {projects.length ? (
        <div className="overflow-x-auto rounded-panel border border-border bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2.5">โครงการ</th>
                <th className="px-3 py-2.5">สถานะ</th>
                <th className="px-3 py-2.5">เจ้าของ</th>
                <th className="px-3 py-2.5 text-right">สมาชิก</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/projects/${project.id}`} className="font-semibold text-operation hover:underline">
                      {project.projectCode}
                    </Link>
                    <span className="block text-ink-soft">{project.projectName}</span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{formatStatusTh(project.status)}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{project.ownerName ?? "ยังไม่ระบุ"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink">{project.memberCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="ยังไม่มีโครงการในระบบ" description="สร้างโครงการแรกจาก /projects/new" />
      )}
    </>
  );
}
