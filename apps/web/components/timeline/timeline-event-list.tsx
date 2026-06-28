import type { TimelineEvent } from "@tomp/types/domain";

export function TimelineEventList({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Timeline</h2>
      <p className="mt-1 text-sm text-slate-600">Immutable operational record. No edit or delete controls are provided.</p>
      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <article key={event.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase text-operation">{event.source} / {event.createdAt}</p>
            <h3 className="mt-1 text-sm font-semibold text-ink">{event.eventType}</h3>
            {event.reason ? <p className="mt-1 text-sm text-slate-600">{event.reason}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
