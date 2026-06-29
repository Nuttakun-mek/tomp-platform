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
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoffLabel, pickupLabel);
  const statusLabel = formatStatusTh(driverAccess.assignment.status);

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-operation">งานของคุณวันนี้</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Call Sign {driverAccess.callSign.callSign}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{driverAccess.project.projectName}</p>
          </div>
          <StatusBadge label={statusLabel} tone="warning" />
        </div>

        <div className="mt-5 grid gap-3">
          <InfoRow label="จุดรับ" value={pickupLabel} />
          <InfoRow label="จุดส่ง" value={dropoffLabel} />
          <InfoRow label="เวลาที่ต้องถึง" value={commitmentTime} />
          <InfoRow label="สถานะงาน" value={statusLabel} />
        </div>

        <a className="mt-5 flex min-h-14 items-center justify-center rounded-md bg-route px-4 py-3 text-base font-semibold text-white shadow-sm" href={mapsUrl}>
          นำทางด้วย Google Maps
        </a>
      </section>

      <DriverQuickActions driverAccess={driverAccess} mapsUrl={mapsUrl} />
      <DriverLocationShare driverAccess={driverAccess} />
      <DriverContactStrip />
      <DriverActivationChecklist driverAccess={driverAccess} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-800">{value}</p>
    </div>
  );
}
