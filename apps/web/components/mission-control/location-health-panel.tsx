import { evaluateLocationHealth } from "@tomp/driver-core";
import type { DriverLocation } from "@tomp/types/domain";

export function LocationHealthPanel({ locations }: { locations: DriverLocation[] }) {
  const latest = locations[0];
  const health = latest
    ? evaluateLocationHealth({
        projectId: latest.projectId,
        assignmentId: latest.assignmentId || "unknown",
        driverId: latest.driverId,
        vehicleId: latest.vehicleId,
        latitude: latest.latitude,
        longitude: latest.longitude,
        accuracy: latest.accuracy,
        recordedAt: latest.recordedAt,
        source: latest.source,
        metadata: latest.metadata
      })
    : evaluateLocationHealth(null);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-blue-900">สุขภาพสัญญาณ GPS</p>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">{health.status}</span>
      </div>
      <p className="mt-2 text-sm text-blue-950">{health.message}</p>
      {health.lastPingAt ? <p className="mt-1 text-xs text-blue-800">ล่าสุด {new Date(health.lastPingAt).toLocaleString("th-TH")}</p> : null}
    </div>
  );
}
