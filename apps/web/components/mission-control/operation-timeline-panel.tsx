import type { TimelineEvent } from "@tomp/types/domain";
import { CommandPanel } from "@/components/ui/command-panel";
import { TimelineItem } from "@/components/ui/timeline-item";

export function OperationTimelinePanel({ events }: { events: TimelineEvent[] }) {
  return (
    <CommandPanel title="ลำดับเหตุการณ์ Timeline" eyebrow="บันทึกถาวรของปฏิบัติการ">
      <div className="grid gap-4">
        {events.length ? (
          events.slice(0, 6).map((event) => (
            <TimelineItem key={event.id} title={event.eventType} detail={event.reason || `${event.objectType} · ${event.source}`} time={new Date(event.createdAt).toLocaleString("th-TH")} />
          ))
        ) : (
          <p className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มี Timeline สำหรับโครงการนี้</p>
        )}
      </div>
    </CommandPanel>
  );
}
