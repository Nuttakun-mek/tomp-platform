"use client";

import { useEffect, useState } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { locationMetaText } from "@/lib/data/location-meta";
import { gpsFreshness } from "@/lib/domain/gps-freshness";
import { formatRelativeTh } from "@/lib/format/relative-time-th";
import { subscribeToDriverLocations, unsubscribeMissionControl } from "@/lib/realtime/mission-control";
import { LiveTrackingMap, toTrackedPoint } from "@/components/mission-control/live-tracking-map";

interface LiveLocationMapProps {
  projectId: string;
  initialLocations: DriverLocation[];
}

function metadataText(location: DriverLocation, key: string, fallback: string) {
  return locationMetaText(location, key, fallback);
}

function getLocationIdentity(location: DriverLocation) {
  return {
    projectCode: metadataText(location, "projectCode", location.projectId),
    projectName: metadataText(location, "projectName", "ไม่พบชื่อโครงการ"),
    callSign: metadataText(location, "callSign", "ยังไม่ระบุ Call Sign"),
    driverName: metadataText(location, "driverName", "ยังไม่ระบุคนขับ"),
    driverPhone: metadataText(location, "driverPhone", "ยังไม่ระบุเบอร์"),
    vehiclePlate: metadataText(location, "vehiclePlate", "ยังไม่ระบุรถ"),
    missionName: metadataText(location, "missionName", "ยังไม่ระบุภารกิจ"),
    assignmentStatus: metadataText(location, "assignmentStatus", "active")
  };
}

function getFreshness(location: DriverLocation, now: number) {
  return gpsFreshness(location.recordedAt, location.sharingEvent, now);
}

function getAgeLabel(location: DriverLocation, now: number) {
  return formatRelativeTh(location.recordedAt, now);
}

function initialClock(locations: DriverLocation[]) {
  const first = locations[0]?.recordedAt;
  return first ? new Date(first).getTime() : 0;
}

export function LiveLocationMap({ projectId, initialLocations }: LiveLocationMapProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [connection, setConnection] = useState<"live" | "fallback" | "offline">("fallback");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [now, setNow] = useState(() => initialClock(initialLocations));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    setHydrated(true);
    setNow(Date.now());

    async function refresh() {
      try {
        const response = await fetch(`/api/mission-control/locations?projectId=${projectId}`, { cache: "no-store" });
        const result = (await response.json()) as { success?: boolean; data?: DriverLocation[]; checkedAt?: string; error?: string };
        if (mounted) {
          if (result.success !== false && Array.isArray(result.data)) {
            setLocations(result.data);
          }
          setLastCheckedAt(result.checkedAt ?? new Date().toISOString());
          setLastError(result.success === false ? result.error || "โหลดตำแหน่งไม่สำเร็จ" : null);
          setNow(Date.now());
          setConnection((current) => (result.success === false ? "offline" : current === "live" ? "live" : "fallback"));
        }
      } catch {
        if (mounted) {
          setConnection("offline");
          setLastCheckedAt(new Date().toISOString());
          setLastError("เชื่อมต่อข้อมูลตำแหน่งไม่ได้");
          setNow(Date.now());
        }
      }
    }

    const channel = subscribeToDriverLocations(projectId, () => {
      setConnection("live");
      void refresh();
    });

    if (channel) setConnection("live");
    const refreshTimer = window.setInterval(refresh, 10000);
    // freshness labels only need ~10s resolution; a 1s clock re-rendered the map every second
    const clockTimer = window.setInterval(() => setNow(Date.now()), 10000);
    void refresh();

    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      unsubscribeMissionControl([channel]);
    };
  }, [projectId]);

  const effectiveNow = now || initialClock(locations) || 0;
  const liveCount = hydrated ? locations.filter((location) => getFreshness(location, effectiveNow) === "live").length : 0;
  const issueCount = hydrated ? locations.filter((location) => ["slow", "offline", "stopped"].includes(getFreshness(location, effectiveNow))).length : 0;

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-950 px-4 py-2.5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold">ทั้งหมด {locations.length}</span>
            <span className="rounded-full bg-emerald-400/90 px-2.5 py-1 font-semibold text-emerald-950">กำลังแชร์ {liveCount}</span>
            <span className="rounded-full bg-amber-300/90 px-2.5 py-1 font-semibold text-amber-950">ต้องติดตาม {issueCount}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connection === "live" ? "bg-emerald-400 text-emerald-950" : connection === "offline" ? "bg-rose-300 text-rose-950" : "bg-amber-300 text-amber-950"}`}>
              {connection === "live" ? "เชื่อมต่อสด" : connection === "offline" ? "ออฟไลน์" : "สำรองด้วยการดึงข้อมูล"}
            </span>
            {lastCheckedAt ? <span className="text-xs text-slate-300">ตรวจล่าสุด {new Date(lastCheckedAt).toLocaleTimeString("th-TH")}</span> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-0">
        <div className="relative min-h-[420px] bg-slate-100">
          {hydrated && locations.length ? (
            <LiveTrackingMap
              height={620}
              points={locations.map((location) => {
                const identity = getLocationIdentity(location);
                return toTrackedPoint(
                  location,
                  getFreshness(location, effectiveNow),
                  identity.callSign,
                  `${identity.vehiclePlate} / ${identity.driverName}`,
                  getAgeLabel(location, effectiveNow)
                );
              })}
            />
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center p-5 text-center">
              <div>
                <p className="font-semibold text-ink">รอตำแหน่ง GPS จากคนขับ</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  เมื่อคนขับเปิด QR และกดแชร์ GPS หมุดรถจะแสดงบนแผนที่นี้ พร้อมเส้นทางและสีตามสถานะสัญญาณ
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <LegendDot color="bg-emerald-500" label="กำลังแชร์ (< 35 วิ)" />
            <LegendDot color="bg-amber-500" label="สัญญาณช้า (> 35 วิ)" />
            <LegendDot color="bg-rose-500" label="ขาดการอัปเดต (> 2 นาที)" />
            <span className="text-slate-400">แตะหมุดเพื่อดูว่าเป็นคันไหน · รายละเอียดอยู่ที่การ์ด “ภาพรวมกองรถ”</span>
          </div>
          {lastError ? <p className="rounded-card border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{lastError}</p> : null}
        </div>
      </div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}

