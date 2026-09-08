import type { TimelineEvent } from "@tomp/types/domain";
import { formatTimelineEventTh } from "@/lib/i18n/timeline-th";

export function TimelineEventList({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="enterprise-panel p-5">
      <h2 className="section-title">Timeline</h2>
      <p className="mt-1 text-sm text-ink-soft">บันทึกการปฏิบัติการที่แก้ไขย้อนหลังไม่ได้ จึงไม่มีปุ่มแก้ไขหรือลบ</p>
      <div className="mt-4 grid gap-3">
        {events.map((event) => (
          <article key={event.id} className="rounded-card border border-slate-200 p-3">
            <p className="text-xs font-semibold text-operation">
              {event.source} · {new Date(event.createdAt).toLocaleString("th-TH")}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-ink">{formatTimelineEventTh(event.eventType)}</h3>
            {event.reason ? <p className="mt-1 text-sm text-slate-600">{event.reason}</p> : null}
          </article>
        ))}
        {!events.length ? <p className="rounded-card border border-slate-200 p-3 text-sm text-slate-600">ยังไม่มีเหตุการณ์ใน Timeline</p> : null}
      </div>
    </section>
  );
}
