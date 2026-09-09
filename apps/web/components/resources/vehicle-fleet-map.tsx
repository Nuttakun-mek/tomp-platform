"use client";

import { useEffect, useState } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { LiveTrackingMap, type MarkerFreshness, type TrackedPoint } from "@/components/mission-control/live-tracking-map";
import { formatRelativeTh } from "@/lib/format/relative-time-th";

function metaText(location: DriverLocation, key: string, fallback: string) {
  const value = location.metadata[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function freshnessOf(location: DriverLocation, now: number): MarkerFreshness {
  if (location.sharingEvent === "sharing_stopped") return "stopped";
  const age = Math.round((now - new Date(location.recordedAt).getTime()) / 1000);
  if (age <= 35) return "live";
  if (age <= 120) return "slow";
  return "offline";
}

export function VehicleFleetMap({ initialLocations }: { initialLocations: DriverLocation[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/mission-control/locations", { cache: "no-store" });
        const json = (await res.json()) as { success?: boolean; data?: DriverLocation[] };
        if (alive && json.success !== false && Array.isArray(json.data)) setLocations(json.data);
        if (alive) setNow(Date.now());
      } catch {
        /* keep last known */
      }
    }
    const timer = window.setInterval(poll, 10000);
    const clock = window.setInterval(() => setNow(Date.now()), 10000);
    void poll();
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, []);

  const points: TrackedPoint[] = locations
    .filter((location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && (location.latitude !== 0 || location.longitude !== 0))
    .map((location) => ({
      id: location.assignmentId || location.vehicleId || location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      freshness: freshnessOf(location, now),
      title: metaText(location, "callSign", "ยังไม่ระบุ Call Sign"),
      subtitle: `${metaText(location, "vehiclePlate", "รถ")} / ${metaText(location, "driverName", "คนขับ")}`,
      ageLabel: formatRelativeTh(location.recordedAt, now),
      accuracy: location.accuracy ?? null
    }));

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-operation">แผนที่รวมรถ</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">ตำแหน่ง GPS ล่าสุดของรถทุกคัน</h2>
          <p className="mt-1 text-xs text-slate-500">หมุดขยับตามตำแหน่งจริง · อัปเดตทุก 10 วินาที · สีตามความสดของสัญญาณ</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{points.length} คันกำลังแชร์</span>
      </div>
      {points.length ? (
        <LiveTrackingMap points={points} height={420} />
      ) : (
        <div className="flex min-h-[240px] items-center justify-center p-5 text-center text-sm leading-6 text-slate-600">
          ยังไม่มีตำแหน่ง GPS จากรถ — เมื่อคนขับเปิดงานและแชร์ GPS หมุดรถจะแสดงและขยับบนแผนที่นี้
        </div>
      )}
    </section>
  );
}
