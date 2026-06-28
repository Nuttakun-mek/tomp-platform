import { StatusBadge } from "@/components/ui/status-badge";
import { DriverActivationChecklist } from "./driver-activation-checklist";
import { DriverContactStrip } from "./driver-contact-strip";
import { DriverQuickActions } from "./driver-quick-actions";

export function DriverCard() {
  return (
    <div className="grid gap-6">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-operation">Demo Event Transportation</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Call Sign A-01</h2>
          </div>
          <StatusBadge label="Draft Assignment" tone="warning" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs font-semibold uppercase text-slate-500">Pickup</p><p className="mt-1 text-sm text-slate-800">Airport arrival gate placeholder</p></div>
          <div><p className="text-xs font-semibold uppercase text-slate-500">Drop-off</p><p className="mt-1 text-sm text-slate-800">Demo venue entrance</p></div>
          <div><p className="text-xs font-semibold uppercase text-slate-500">Commitment</p><p className="mt-1 text-sm text-slate-800">Pickup by 08:30 ICT</p></div>
          <div><p className="text-xs font-semibold uppercase text-slate-500">Navigation</p><a className="mt-1 block text-sm font-semibold text-route" href="https://www.google.com/maps/dir/?api=1&destination=Demo%20Venue">Google Maps placeholder</a></div>
        </div>
      </section>
      <DriverQuickActions />
      <DriverContactStrip />
      <DriverActivationChecklist />
    </div>
  );
}
