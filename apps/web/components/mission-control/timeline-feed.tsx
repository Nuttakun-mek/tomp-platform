import type { TimelineEvent } from "@tomp/types/domain";

export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Timeline Feed</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Immutable operational black box. Sample events only; no edit or delete controls are provided.</p>
      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-operation">{event.createdAt} / {event.source}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{event.eventType}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
