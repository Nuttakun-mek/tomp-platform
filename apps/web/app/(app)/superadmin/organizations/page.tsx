import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { listOrganizationsWithCounts } from "@/lib/superadmin/overview";

export default async function SuperadminOrganizationsPage() {
  const orgs = await listOrganizationsWithCounts();

  return (
    <>
      <PageHeader
        eyebrow="ทีมแพลตฟอร์ม"
        title="องค์กร"
        description="องค์กรทั้งหมดในระบบ พร้อมจำนวนโครงการและสมาชิก"
      />
      {orgs.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((org) => (
            <article key={org.id} className="smart-card grid gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="card-title">{org.name}</h3>
                <span className="rounded-command bg-canvas px-2 py-1 text-[11px] font-semibold text-ink-soft">{formatStatusTh(org.status)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-card border border-border bg-white px-2 py-2">
                  <dd className="text-lg font-semibold text-ink">{org.projectCount}</dd>
                  <dt className="text-[11px] text-ink-faint">โครงการ</dt>
                </div>
                <div className="rounded-card border border-border bg-white px-2 py-2">
                  <dd className="text-lg font-semibold text-ink">{org.memberCount}</dd>
                  <dt className="text-[11px] text-ink-faint">สมาชิก</dt>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="ยังไม่มีองค์กรในระบบ" description="องค์กรแรกจะถูกสร้างเมื่อผู้ใช้คนแรกเข้าสู่ระบบ" />
      )}
    </>
  );
}
