import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResetPasswordButton } from "@/components/superadmin/reset-password-button";
import { roleLabelTh } from "@/lib/i18n/role-th";
import type { ProfileRow } from "@/lib/superadmin/users";

const STATUS_TH: Record<string, string> = {
  active: "ใช้งาน",
  invited: "รอเข้าสู่ระบบ",
  inactive: "ปิดใช้งาน"
};

// tone mapping follows the same neutral/ready/warning semantics ProjectsPage
// already applies via StatusBadge (apps/web/app/(app)/projects/page.tsx):
// "good to go" -> ready, "pending" -> warning, everything else -> neutral.
const STATUS_TONE: Record<string, "neutral" | "ready" | "warning" | "critical"> = {
  active: "ready",
  invited: "warning",
  inactive: "neutral"
};

export function UserList({ rows }: { rows: ProfileRow[] }) {
  if (!rows.length) {
    return <EmptyState title="ยังไม่มีผู้ใช้" description="เพิ่มผู้ใช้คนแรกจากฟอร์มด้านซ้าย" />;
  }
  return (
    <div className="enterprise-panel overflow-hidden">
      <div className="grid gap-px bg-border">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-2 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{row.fullName || "ยังไม่ระบุชื่อ"}</p>
              <p className="truncate text-xs text-ink-faint">{row.email || "ยังไม่ระบุอีเมล"}</p>
            </div>
            <div className="grid gap-1.5 sm:justify-items-end">
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                {/* StatusBadge matches the account-status indicator already used for
                    project status in projects/page.tsx and mission status in
                    portal-mission-status.tsx, instead of a one-off colored pill. */}
                <StatusBadge label={STATUS_TH[row.status] ?? row.status} tone={STATUS_TONE[row.status] ?? "neutral"} />
                {row.roleKeys.length ? (
                  row.roleKeys.map((key) => (
                    <span key={key} className="rounded-full bg-operation-soft px-2.5 py-1 text-[11px] font-semibold text-operation">
                      {roleLabelTh(key)}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">ยังไม่มีบทบาท</span>
                )}
              </div>
              <ResetPasswordButton profileId={row.id} hasLogin={row.hasLogin} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
