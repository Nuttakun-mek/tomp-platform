import { NotificationCard } from "@/components/ui/notification-card";
import type { DriverNotification } from "@tomp/types/domain";
import { formatStatusTh } from "@/lib/i18n/status-th";

type Tone = "info" | "warning" | "critical";

function toneFor(priority?: string | null): Tone {
  if (priority === "critical" || priority === "urgent") return "critical";
  if (priority === "high" || priority === "warning") return "warning";
  return "info";
}

export function DriverNotificationConsole({ notifications = [] }: { notifications?: DriverNotification[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <p className="section-label">แจ้งเตือนคนขับ</p>
      <div className="mt-4 grid gap-3">
        {notifications.length ? (
          notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              title={notification.title || "แจ้งเตือน"}
              body={notification.body || formatStatusTh(notification.status)}
              tone={toneFor(notification.priority)}
              at={notification.createdAt}
              actionHref={notification.actionUrl ?? undefined}
              actionLabel={notification.actionLabel ?? undefined}
            />
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">ยังไม่มีการแจ้งเตือนคนขับในโครงการนี้</p>
        )}
      </div>
    </section>
  );
}
