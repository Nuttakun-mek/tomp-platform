"use client";

import { useEffect, useMemo, useState } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { subscribeToDriverLocations, unsubscribeMissionControl } from "@/lib/realtime/mission-control";

interface LiveLocationMapProps {
  projectId: string;
  initialLocations: DriverLocation[];
}

function getLocationLabel(location: DriverLocation) {
  const callSign = String(location.metadata.callSign || "ยังไม่ระบุ Call Sign");
  const driverName = String(location.metadata.driverName || "คนขับ");
  return { callSign, driverName };
}

function buildOsmEmbedUrl(location: DriverLocation) {
  const { latitude, longitude } = location;
  const delta = 0.015;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function buildGoogleMapsUrl(location: DriverLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
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
          if (result.data.length && connection !== "live") {
            setConnection("fallback");
          }
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
  }, [connection, projectId]);

  const mapUrl = useMemo(() => (latest ? buildOsmEmbedUrl(latest) : null), [latest]);
  const latestLabel = latest ? getLocationLabel(latest) : null;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">แผนที่ติดตามสถานะ</p>
            <h2 className="mt-1 text-xl font-semibold">ตำแหน่งคนขับแบบเรียลไทม์</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-200">
              แสดงตำแหน่งล่าสุดที่ส่งจาก web app คนขับโดยตรง ข้อมูลนี้ใช้เพื่อมองภาพรวมการปฏิบัติการ ไม่ใช่ระบบควบคุมคนขับ
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              connection === "live"
                ? "bg-emerald-400 text-emerald-950"
                : connection === "offline"
                  ? "bg-rose-300 text-rose-950"
                  : "bg-amber-300 text-amber-950"
            }`}
          >
            {connection === "live" ? "Live" : connection === "offline" ? "Offline" : "กำลังสำรองข้อมูล"}
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="min-h-[360px] bg-slate-100">
          {mapUrl && latest ? (
            <div className="relative h-full min-h-[360px]">
              <iframe
                className="h-[360px] w-full border-0 lg:h-full lg:min-h-[520px]"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={mapUrl}
                title="แผนที่ตำแหน่งคนขับ"
              />
              <div className="absolute left-4 top-4 max-w-xs rounded-md border border-slate-200 bg-white/95 p-3 shadow-soft">
                <p className="text-xs font-semibold text-slate-500">ตำแหน่งล่าสุด</p>
                <p className="mt-1 font-semibold text-ink">{latestLabel?.callSign}</p>
                <p className="text-sm text-slate-600">{latestLabel?.driverName}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(latest.recordedAt).toLocaleString("th-TH")}</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center p-6 text-center">
              <div className="max-w-md rounded-md border border-dashed border-slate-300 bg-white p-6">
                <p className="text-lg font-semibold text-ink">ยังไม่มีตำแหน่งคนขับจริง</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  เปิดหน้าคนขับด้วยลิงก์ QR แล้วกดเริ่มแชร์ตำแหน่ง GPS แผนที่จะอัปเดตอัตโนมัติเมื่อมีข้อมูลจากมือถือ
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid content-start gap-3 border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
          <div>
            <p className="text-sm font-semibold text-ink">คนขับที่มีตำแหน่งล่าสุด</p>
            <p className="text-xs text-slate-500">{locations.length} รายการจากโครงการนี้</p>
          </div>

          {locations.length ? (
            locations.map((location) => {
              const label = getLocationLabel(location);
              return (
                <article key={location.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{label.callSign}</p>
                      <p className="text-sm text-slate-600">{label.driverName}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">GPS ล่าสุด</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{new Date(location.recordedAt).toLocaleString("th-TH")}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ความแม่นยำ {location.accuracy ? `${Math.round(location.accuracy)} เมตร` : "ไม่ระบุ"}
                  </p>
                  <a
                    className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    href={buildGoogleMapsUrl(location)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    เปิดตำแหน่งใน Google Maps
                  </a>
                </article>
              );
            })
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              ยังไม่มีข้อมูลตำแหน่งสำหรับโครงการนี้ หากกำลังทดสอบ ให้เปิดหน้าคนขับบนมือถือและอนุญาตการเข้าถึงตำแหน่ง
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
