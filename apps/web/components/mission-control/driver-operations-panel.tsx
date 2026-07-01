import type { DriverLocation } from "@tomp/types/domain";
import type { DriverOperationSummary } from "@/lib/data/driver-operations";
import { LocationHealthPanel } from "./location-health-panel";

export function DriverOperationsPanel({ locations, summary }: { locations: DriverLocation[]; summary: DriverOperationSummary }) {
  const acknowledged = summary.acknowledgedPackets;
  const pending = Math.max(0, summary.packets - summary.acknowledgedPackets);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-operation">Driver Operations</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">สถานะคนขับและการรับทราบงาน</h2>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">{summary.packets ? "ข้อมูลจริง" : "ข้อมูลตัวอย่าง"}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="รับทราบแล้ว" value={acknowledged} tone="text-emerald-700" />
        <Metric label="รอรับทราบ" value={pending} tone="text-amber-700" />
        <Metric label="GPS ล่าสุด" value={summary.activeLocationSessions || locations.length} tone="text-blue-700" />
      </div>
      <div className="mt-4">
        <LocationHealthPanel locations={locations} />
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
