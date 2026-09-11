import type { LocaleCode } from "@/lib/i18n/locales";
import { gpsFreshnessLabel, type GpsFreshness } from "@/lib/domain/gps-freshness";
import { TRACKING_MARKER_COLORS } from "@/components/mission-control/live-tracking-map";

const states: GpsFreshness[] = ["live", "idle", "slow", "offline", "stopped"];

export function FleetLegend({ locale }: { locale: LocaleCode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{locale === "th" ? "คำอธิบายสถานะ" : "Legend"}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {states.map((state) => (
          <div key={state} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TRACKING_MARKER_COLORS[state] }} />
            {gpsFreshnessLabel(state, locale)}
          </div>
        ))}
      </div>
    </div>
  );
}
