"use client";

import { useEffect, useState } from "react";
import { RealtimeStatus } from "@/components/mission-control/realtime-status";
import { subscribeToMissionControl, type MissionControlRealtimeEvent } from "@/lib/realtime/mission-control-channel";

export function RealtimeStatusPanel({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<MissionControlRealtimeEvent[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToMissionControl(projectId, (event) => {
      setEnabled(true);
      setEvents((current) => [event, ...current].slice(0, 5));
    });

    return unsubscribe;
  }, [projectId]);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-operation">Realtime Foundation</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{enabled ? "Listening for operational changes" : "Realtime subscribe-ready"}</h2>
        <RealtimeStatus state={enabled ? "Live" : "Fallback"} />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">Subscribes to timeline, assignment status, and driver issue changes when Supabase browser env is configured. This is not production GPS streaming.</p>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        {events.length ? events.map((event, index) => <p key={`${event.table}-${index}`}>{event.eventType} on {event.table}</p>) : <p>No realtime events received in this session.</p>}
      </div>
    </section>
  );
}
