import { StatusBadge } from "@/components/ui/status-badge";

const exceptions = ["Driver not ready", "Vehicle not ready", "Missing vehicle photo", "Missing GPS consent placeholder"];

export function ExceptionList() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Exception List</h2>
      <div className="mt-4 grid gap-3">
        {exceptions.map((item) => (
          <div key={item} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
            <span className="text-sm text-slate-700">{item}</span>
            <StatusBadge label="Sample" tone="warning" />
          </div>
        ))}
      </div>
    </section>
  );
}
