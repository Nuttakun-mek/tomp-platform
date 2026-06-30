import { StatusBadge } from "@/components/ui/status-badge";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { buildGoogleMapsDirectionsUrl } from "@/lib/domain/assignment-rules";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { DriverActivationChecklist } from "./driver-activation-checklist";
import { DriverContactStrip } from "./driver-contact-strip";
import { DriverLocationShare } from "./driver-location-share";
import { DriverQuickActions } from "./driver-quick-actions";

export function DriverCard({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const pickupLabel = String(driverAccess.assignment.metadata.pickupLocation || driverAccess.assignment.metadata.pickup_location || "ยังไม่ระบุจุดรับ");
  const dropoffLabel = String(driverAccess.assignment.metadata.dropoffLocation || driverAccess.assignment.metadata.dropoff_location || "ยังไม่ระบุจุดส่ง");
  const commitmentTime = String(driverAccess.assignment.metadata.commitmentTime || driverAccess.assignment.metadata.commitment_time || "ยังไม่ระบุเวลา");
  const coordinatorPhone = String(driverAccess.assignment.metadata.coordinatorPhone || driverAccess.assignment.metadata.coordinator_phone || "ติดต่อศูนย์ควบคุม");
  const operationPhone = String(driverAccess.assignment.metadata.operationPhone || driverAccess.assignment.metadata.operation_phone || "ติดต่อศูนย์ควบคุม");
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoffLabel, pickupLabel);
  const statusLabel = formatStatusTh(driverAccess.assignment.status);

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-panel">
        <div className="bg-slate-950 p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-200">งานของคุณวันนี้</p>
              <h2 className="mt-2 text-3xl font-semibold">Call Sign {driverAccess.callSign.callSign}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-200">{driverAccess.project.projectName}</p>
            </div>
            <StatusBadge label={statusLabel} tone="warning" />
          </div>
        </div>

        <div className="grid gap-3 p-5">
          <InfoRow label="จุดรับ" value={pickupLabel} strong />
          <InfoRow label="จุดส่ง" value={dropoffLabel} strong />
          <InfoRow label="เวลาที่ต้องถึง" value={commitmentTime} />
          <InfoRow label="สถานะงาน" value={statusLabel} />
          <InfoRow label="ผู้ประสานงาน" value={coordinatorPhone} />
          <InfoRow label="เบอร์ศูนย์ควบคุม" value={operationPhone} />
        </div>

        <div className="border-t border-slate-200 p-5">
          <a className="flex min-h-14 items-center justify-center rounded-md bg-route px-4 py-3 text-base font-semibold text-white shadow-sm" href={mapsUrl}>
            นำทางด้วย Google Maps
          </a>
        </div>
      </section>

      <DriverQuickActions driverAccess={driverAccess} mapsUrl={mapsUrl} />
      <DriverLocationShare driverAccess={driverAccess} />
      <DriverContactStrip />
      <DriverActivationChecklist driverAccess={driverAccess} />
    </div>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 ${strong ? "text-lg" : "text-base"} font-semibold text-slate-800`}>{value}</p>
    </div>
  );
}
