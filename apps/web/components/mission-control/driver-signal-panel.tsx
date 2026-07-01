import type { DriverLocation } from "@tomp/types/domain";
import { CommandPanel } from "@/components/ui/command-panel";
import { StatusDot } from "@/components/ui/status-dot";

function ageSeconds(recordedAt: string) {
  return Math.max(0, Math.round((Date.now() - new Date(recordedAt).getTime()) / 1000));
}

export function DriverSignalPanel({ locations }: { locations: DriverLocation[] }) {
  return (
    <CommandPanel title="สัญญาณคนขับ" eyebrow="สถานะการส่งตำแหน่ง">
      <div className="grid gap-3">
        {locations.length ? (
          locations.slice(0, 6).map((location) => {
            const age = ageSeconds(location.recordedAt);
            const tone = age <= 35 ? "success" : age <= 120 ? "warning" : "danger";
            return (
              <article key={location.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50/80 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{String(location.metadata.callSign || "ยังไม่ระบุ Call Sign")}</p>
                  <p className="truncate text-sm text-slate-600">{String(location.metadata.driverName || "ยังไม่ระบุคนขับ")}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <StatusDot tone={tone} pulse={tone === "success"} />
                  {age < 60 ? `${age} วินาที` : `${Math.round(age / 60)} นาที`}
                </span>
              </article>
            );
          })
        ) : (
          <p className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มี GPS จากคนขับ</p>
        )}
      </div>
    </CommandPanel>
  );
}
