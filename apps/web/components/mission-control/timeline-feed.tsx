import type { TimelineEvent } from "@tomp/types/domain";

export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">ลำดับเหตุการณ์</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">Timeline คือบันทึกการปฏิบัติการที่แก้ไขย้อนหลังไม่ได้ จึงไม่มีปุ่มแก้ไขหรือลบเหตุการณ์</p>
      <div className="mt-4 grid gap-3">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="rounded-md border border-slate-200 p-3">
              <p className="text-xs font-semibold text-operation">{event.createdAt} / {event.source}</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{event.eventType}</p>
              {event.reason ? <p className="mt-1 text-xs text-slate-500">{event.reason}</p> : null}
            </div>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">ยังไม่มีเหตุการณ์ใน Timeline</p>
        )}
      </div>
    </section>
  );
}
