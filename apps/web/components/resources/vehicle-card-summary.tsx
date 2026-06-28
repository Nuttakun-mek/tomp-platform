import type { Vehicle } from "@tomp/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";

export function VehicleCardSummary({ vehicle }: { vehicle: Vehicle }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{vehicle.plateNumber}</h3>
          <p className="mt-1 text-sm text-slate-600">{vehicle.vehicleType} / {vehicle.capacity} seats</p>
        </div>
        <StatusBadge label={vehicle.status} tone={vehicle.status === "available" ? "ready" : "neutral"} />
      </div>
    </article>
  );
}
