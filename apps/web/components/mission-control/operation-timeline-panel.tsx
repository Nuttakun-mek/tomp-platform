"use client";

import type { TimelineEvent } from "@tomp/types/domain";
import { CommandPanel } from "@/components/ui/command-panel";
import { TimelineItem } from "@/components/ui/timeline-item";
import { useVisibleSlice } from "@/components/ui/use-visible-slice";
import { formatTimelineEventTh } from "@/lib/i18n/timeline-th";

export function OperationTimelinePanel({ events }: { events: TimelineEvent[] }) {
  const { visible, hidden, hasMore, expanded, showMore, reset } = useVisibleSlice(events, 10);

  return (
    <CommandPanel title="ลำดับเหตุการณ์ Timeline" eyebrow="บันทึกถาวรของปฏิบัติการ">
      <div className="grid gap-4">
        {events.length ? (
          <>
            {visible.map((event) => (
              <TimelineItem
                key={event.id}
                title={formatTimelineEventTh(event.eventType)}
                detail={event.reason || `${event.objectType} · ${event.source}`}
                time={new Date(event.createdAt).toLocaleString("th-TH")}
              />
            ))}
            {hasMore || expanded ? (
              <button
                type="button"
                onClick={hasMore ? showMore : reset}
                className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-operation hover:text-operation"
              >
                {hasMore ? `ดูเพิ่ม (อีก ${hidden})` : "ย่อรายการ"}
              </button>
            ) : null}
          </>
        ) : (
          <p className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มี Timeline สำหรับโครงการนี้</p>
        )}
      </div>
    </CommandPanel>
  );
}
