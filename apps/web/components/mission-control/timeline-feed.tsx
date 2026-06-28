const events = [
  { time: "08:00", title: "Plan baseline prepared", source: "system" },
  { time: "08:10", title: "Assignment A-01 drafted", source: "operation_user" },
  { time: "08:15", title: "Driver card preview opened", source: "driver_qr" }
];

export function TimelineFeed() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Timeline Feed</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Immutable operational black box. Sample events only; no edit or delete controls are provided.</p>
      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <div key={`${event.time}-${event.title}`} className="rounded-md border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-operation">{event.time} / {event.source}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{event.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
