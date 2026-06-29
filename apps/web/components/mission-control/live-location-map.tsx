"use client";

import { useEffect, useMemo, useState } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { subscribeToDriverLocations, unsubscribeMissionControl } from "@/lib/realtime/mission-control";

interface LiveLocationMapProps {
  projectId: string;
  initialLocations: DriverLocation[];
}

export function LiveLocationMap({ projectId, initialLocations }: LiveLocationMapProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [connection, setConnection] = useState<"live" | "fallback" | "offline">("fallback");
  const latest = locations[0];

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const response = await fetch(`/api/mission-control/locations?projectId=${projectId}`, { cache: "no-store" });
        const result = (await response.json()) as { data?: DriverLocation[] };
        if (mounted && result.data) {
          setLocations(result.data);
        }
      } catch {
        if (mounted) setConnection("offline");
      }
    }

    const channel = subscribeToDriverLocations(projectId, () => {
      setConnection("live");
      void refresh();
    });

    if (channel) {
      setConnection("live");
    }

    const timer = window.setInterval(refresh, 7000);
    void refresh();

    return () => {
      mounted = false;
      window.clearInterval(timer);
      unsubscribeMissionControl([channel]);
    };
  }, [projectId]);

  const mapUrl = useMemo(() => {
    const lat = latest?.latitude ?? 13.7563;
    const lng = latest?.longitude ?? 100.5018;
    const delta = 0.02;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;
  }, [latest]);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">แผนที่ตำแหน่งคนขับ</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            แสดงตำแหน่งล่าสุดจาก web app คนขับ สำหรับทดสอบเทคโนโลยีภายใน ยังไม่ใช่ระบบติดตาม production
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {connection === "live" ? "Live" : connection === "offline" ? "Offline" : "Fallback"}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
        <iframe className="h-80 w-full" loading="lazy" referrerPolicy="no-referrer" src={mapUrl} title="แผนที่ตำแหน่งคนขับ" />
      </div>

      <div className="mt-4 grid gap-3">
        {locations.length ? (
          locations.map((location) => (
            <div key={location.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">
                  {String(location.metadata.callSign || "Call Sign ไม่ระบุ")}
                </p>
                <p className="text-xs font-medium text-slate-500">{new Date(location.recordedAt).toLocaleString("th-TH")}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {String(location.metadata.driverName || "คนขับ")} | {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ความแม่นยำ {location.accuracy ? `${Math.round(location.accuracy)} เมตร` : "ไม่ระบุ"} {location.source === "demo" ? "| ข้อมูลตัวอย่าง" : ""}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
            ยังไม่มีตำแหน่งคนขับ ให้คนขับเปิดหน้า QR แล้วกดเริ่มแชร์ตำแหน่ง
          </div>
        )}
      </div>
    </section>
  );
}
