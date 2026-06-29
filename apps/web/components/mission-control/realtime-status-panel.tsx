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
      <p className="text-xs font-semibold text-operation">สถานะการเชื่อมต่อ</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{enabled ? "กำลังรับข้อมูลการเปลี่ยนแปลง" : "พร้อมเชื่อมต่อ Realtime"}</h2>
        <RealtimeStatus state={enabled ? "Live" : "Fallback"} />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">เมื่อกำหนดค่า Supabase แล้ว หน้านี้สามารถรับเหตุการณ์ Timeline สถานะ Assignment และเรื่องแจ้งจากคนขับได้ โดยยังไม่ใช่ระบบติดตาม GPS แบบ production</p>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        {events.length ? events.map((event, index) => <p key={`${event.table}-${index}`}>{event.eventType} จาก {event.table}</p>) : <p>ยังไม่มีเหตุการณ์ Realtime ในรอบการใช้งานนี้</p>}
      </div>
    </section>
  );
}
