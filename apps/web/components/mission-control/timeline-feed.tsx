import type { TimelineEvent } from "@tomp/types/domain";

export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">ลำดับเหตุการณ์</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Timeline เป็นบันทึกการปฏิบัติการที่แก้ไขย้อนหลังไม่ได้</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {events.length ? (
          events.map((event) => (
            <article key={event.id} className="relative rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-operation">{event.createdAt} / {event.source}</p>
              <h3 className="mt-1 text-sm font-semibold text-ink">{event.eventType}</h3>
              {event.reason ? <p className="mt-1 text-sm leading-6 text-slate-600">{event.reason}</p> : null}
            </article>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">ยังไม่มีเหตุการณ์ใน Timeline</p>
        )}
      </div>
    </section>
  );
}
