"use client";

import { useEffect, useState } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { formatRelativeTh } from "@/lib/format/relative-time-th";
import { subscribeToDriverLocations, unsubscribeMissionControl } from "@/lib/realtime/mission-control";
import { LiveTrackingMap, toTrackedPoint } from "@/components/mission-control/live-tracking-map";

interface LiveLocationMapProps {
  projectId: string;
  initialLocations: DriverLocation[];
}

type LocationFreshness = "live" | "slow" | "offline" | "stopped";

function metadataText(location: DriverLocation, key: string, fallback: string) {
  const value = location.metadata[key];
  return typeof value === "string" && value.trim() ? value : fallback;
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

function getFreshness(location: DriverLocation, now: number): LocationFreshness {
  if (location.sharingEvent === "sharing_stopped") return "stopped";
  const ageSeconds = Math.max(0, Math.round((now - new Date(location.recordedAt).getTime()) / 1000));
  if (ageSeconds <= 35) return "live";
  if (ageSeconds <= 120) return "slow";
  return "offline";
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
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-blue-200">แผนที่ติดตามสถานะ</p>
            <h2 className="mt-1 text-lg font-semibold md:text-xl">ตำแหน่งคนขับแบบเรียลไทม์</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-200">
              ทุกหมุดผูกกับโครงการ Assignment, Call Sign, คนขับ และรถ สีของหมุดแสดงความสดของสัญญาณ GPS ล่าสุด
            </p>
          </div>
          <div className="grid justify-items-start gap-2 sm:justify-items-end">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connection === "live" ? "bg-emerald-400 text-emerald-950" : connection === "offline" ? "bg-rose-300 text-rose-950" : "bg-amber-300 text-amber-950"}`}>
              {connection === "live" ? "เชื่อมต่อสด" : connection === "offline" ? "ออฟไลน์" : "สำรองด้วยการดึงข้อมูล"}
            </span>
            {lastCheckedAt ? <span className="text-xs text-slate-300">ตรวจล่าสุด {new Date(lastCheckedAt).toLocaleTimeString("th-TH")}</span> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="relative min-h-[380px] bg-slate-100">
          {hydrated && locations.length ? (
            <LiveTrackingMap
              height={480}
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
            <div className="flex h-full min-h-[380px] items-center justify-center p-6 text-center">
              <div>
                <p className="font-semibold text-ink">รอตำแหน่ง GPS จากคนขับ</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  เมื่อคนขับเปิด QR และกดแชร์ GPS หมุดรถจะแสดงบนแผนที่นี้ พร้อมเส้นทางและสีตามสถานะสัญญาณ
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid content-start gap-3 border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-2">
            <MapMetric label="ทั้งหมด" value={locations.length} />
            <MapMetric label="กำลังแชร์" value={liveCount} tone="success" />
            <MapMetric label="ต้องติดตาม" value={issueCount} tone="warning" />
          </div>

          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <LegendDot color="bg-emerald-500" label="กำลังแชร์: อัปเดตไม่เกิน 35 วินาที" />
            <LegendDot color="bg-amber-500" label="สัญญาณช้า: เกิน 35 วินาที" />
            <LegendDot color="bg-rose-500" label="ขาดการอัปเดต: เกิน 2 นาที" />
          </div>

          <p className="text-xs leading-5 text-slate-500">
            แตะหมุดบนแผนที่เพื่อดูว่าเป็นคันไหน · รายละเอียดคนขับ/รถ สถานะ และข้อความ ดูได้ที่การ์ด “ภาพรวมกองรถ”
          </p>

          {lastError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{lastError}</div> : null}

          {!locations.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              ยังไม่มีข้อมูลตำแหน่งสำหรับโครงการนี้ เมื่อคนขับเปิดแชร์ GPS หมุดจะแสดงที่นี่
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MapMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  const className = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-ink";
  return (
    <div className={`rounded-2xl border p-3 ${className}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
    </div>
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

