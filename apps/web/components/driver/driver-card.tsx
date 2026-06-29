import { StatusBadge } from "@/components/ui/status-badge";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { buildGoogleMapsDirectionsUrl } from "@/lib/domain/assignment-rules";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { DriverActivationChecklist } from "./driver-activation-checklist";
import { DriverContactStrip } from "./driver-contact-strip";
import { DriverQuickActions } from "./driver-quick-actions";

export function DriverCard({ driverAccess }: { driverAccess?: DriverAccessAssignment }) {
  const pickupLabel = "จุดรับผู้โดยสาร";
  const dropoffLabel = "จุดส่งปลายทาง";
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoffLabel, pickupLabel);
  const projectName = driverAccess?.project.projectName ?? "ข้อมูลตัวอย่าง: งานรับส่งผู้ร่วมงาน";
  const callSign = driverAccess?.callSign.callSign ?? "A-01";
  const assignment = driverAccess?.assignment;
  const statusLabel = assignment?.status ? formatStatusTh(assignment.status) : "รอเริ่มงาน";

  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-operation">งานของคุณวันนี้</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">Call Sign {callSign}</h2>
            <p className="mt-2 text-sm text-slate-600">{projectName}</p>
          </div>
          <StatusBadge label={statusLabel} tone="warning" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">จุดรับ</p><p className="mt-1 text-base font-semibold text-slate-800">{pickupLabel}</p></div>
          <div className="rounded-md bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">จุดส่ง</p><p className="mt-1 text-base font-semibold text-slate-800">{dropoffLabel}</p></div>
          <div className="rounded-md bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">เวลาที่ต้องถึง</p><p className="mt-1 text-base font-semibold text-slate-800">ถึงจุดรับภายใน 08:30 ICT</p></div>
          <div className="rounded-md bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">สถานะงาน</p><p className="mt-1 text-base font-semibold text-slate-800">{statusLabel}</p></div>
        </div>
        <a className="mt-5 flex min-h-12 items-center justify-center rounded-md bg-route px-4 py-3 text-base font-semibold text-white" href={mapsUrl}>
          นำทางด้วย Google Maps
        </a>
      </section>
      <DriverQuickActions driverAccess={driverAccess} mapsUrl={mapsUrl} />
      <DriverContactStrip />
      <DriverActivationChecklist driverAccess={driverAccess} />
    </div>
  );
}
