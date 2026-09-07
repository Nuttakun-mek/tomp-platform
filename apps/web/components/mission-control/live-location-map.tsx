"use client";

import { useEffect, useMemo, useState } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { Tooltip } from "@/components/ui/tooltip";
import { subscribeToDriverLocations, unsubscribeMissionControl } from "@/lib/realtime/mission-control";
import { formatStatusTh } from "@/lib/i18n/status-th";

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

function getFreshnessLabel(status: LocationFreshness) {
  if (status === "live") return "กำลังแชร์";
  if (status === "slow") return "สัญญาณช้า";
  if (status === "stopped") return "หยุดแชร์แล้ว";
  return "ขาดการอัปเดต";
}

function getFreshnessClass(status: LocationFreshness) {
  if (status === "live") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "slow") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "stopped") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-rose-300 bg-rose-50 text-rose-900";
}

function getMarkerClass(status: LocationFreshness) {
  if (status === "live") return "bg-emerald-500 ring-emerald-200";
  if (status === "slow") return "bg-amber-500 ring-amber-200";
  if (status === "stopped") return "bg-slate-500 ring-slate-200";
  return "bg-rose-500 ring-rose-200";
}

function getAgeLabel(location: DriverLocation, now: number) {
  const ageSeconds = Math.max(0, Math.round((now - new Date(location.recordedAt).getTime()) / 1000));
  if (ageSeconds < 60) return `${ageSeconds} วินาทีที่แล้ว`;
  return `${Math.round(ageSeconds / 60)} นาทีที่แล้ว`;
}

function buildGoogleMapsUrl(location: DriverLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function getMarkerPosition(location: DriverLocation, locations: DriverLocation[]) {
  const latitudes = locations.map((item) => item.latitude);
  const longitudes = locations.map((item) => item.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.001);
  const lngRange = Math.max(maxLng - minLng, 0.001);
  return {
    left: `${12 + ((location.longitude - minLng) / lngRange) * 76}%`,
    top: `${12 + ((maxLat - location.latitude) / latRange) * 76}%`
  };
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
  const latest = locations[0];
  const latestLatitude = latest?.latitude;
  const latestLongitude = latest?.longitude;

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
    const refreshTimer = window.setInterval(refresh, 7000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    void refresh();

    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      unsubscribeMissionControl([channel]);
    };
  }, [projectId]);

  const mapUrl = useMemo(() => {
    const centerLatitude = latestLatitude ?? 13.7563;
    const centerLongitude = latestLongitude ?? 100.5018;
    const delta = 0.012;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${centerLongitude - delta}%2C${centerLatitude - delta}%2C${centerLongitude + delta}%2C${centerLatitude + delta}&layer=mapnik`;
  }, [latestLatitude, latestLongitude]);

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
        <div className="min-h-[380px] bg-slate-100">
          <div className="relative h-full min-h-[380px] overflow-hidden">
            <iframe className="h-[380px] w-full border-0 opacity-80 lg:h-full lg:min-h-[500px]" loading="lazy" referrerPolicy="no-referrer" src={mapUrl} title="แผนที่ตำแหน่งคนขับ" />

            {locations.map((location) => {
              const status = hydrated ? getFreshness(location, effectiveNow) : "slow";
              const identity = getLocationIdentity(location);
              const position = getMarkerPosition(location, locations);
              return (
                <div key={location.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={position}>
                  {status === "live" ? <span className="absolute inline-flex h-8 w-8 -translate-x-2 -translate-y-2 animate-ping rounded-full bg-emerald-400 opacity-60" /> : null}
                  <a className={`relative flex h-4 w-4 rounded-full ring-8 ${getMarkerClass(status)}`} href={buildGoogleMapsUrl(location)} rel="noreferrer" target="_blank" title={`${identity.callSign} / ${identity.driverName}`} />
                  <div className="absolute left-5 top-0 min-w-44 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-soft">
                    <p className="font-semibold text-ink">{identity.callSign}</p>
                    <p className="text-slate-600">{identity.vehiclePlate} / {identity.driverName}</p>
                    <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 font-semibold ${getFreshnessClass(status)}`}>{getFreshnessLabel(status)}</p>
                  </div>
                </div>
              );
            })}
            {!latest ? (
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm shadow-soft">
                <p className="font-semibold text-ink">รอตำแหน่ง GPS จากคนขับ</p>
                <p className="mt-1 leading-6 text-slate-600">เมื่อคนขับเปิด QR และกดแชร์ GPS หมุดรถจะแสดงบนแผนที่นี้พร้อมสีตามสถานะสัญญาณ</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid content-start gap-3 border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-2">
            <MapMetric label="ทั้งหมด" value={locations.length} />
            <MapMetric label="กำลังแชร์" value={liveCount} tone="success" />
            <MapMetric label="ต้องติดตาม" value={issueCount} tone="warning" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink">ตำแหน่งล่าสุด</p>
              <Tooltip content="รายการนี้บอกว่าตำแหน่งมาจากโครงการใด รถคันใด คนขับคนใด และอัปเดตล่าสุดเมื่อไร">
                <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
              </Tooltip>
            </div>
            <p className="text-xs text-slate-500">แยกตาม Assignment เพื่อรู้ว่าใครอยู่ในงานใด</p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <LegendDot color="bg-emerald-500" label="กำลังแชร์: อัปเดตไม่เกิน 35 วินาที" />
            <LegendDot color="bg-amber-500" label="สัญญาณช้า: เกิน 35 วินาที" />
            <LegendDot color="bg-rose-500" label="ขาดการอัปเดต: เกิน 2 นาที" />
          </div>

          {lastError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{lastError}</div> : null}

          {locations.length ? (
            locations.map((location) => {
              const identity = getLocationIdentity(location);
              const status = hydrated ? getFreshness(location, effectiveNow) : "slow";
              return (
                <article key={location.id} className={`rounded-2xl border p-4 ${getFreshnessClass(status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{identity.callSign}</p>
                      <p className="text-sm">{identity.vehiclePlate} / {identity.driverName}</p>
                    </div>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{getFreshnessLabel(status)}</span>
                  </div>
                  <dl className="mt-3 grid gap-1 text-xs">
                    <InfoRow label="โครงการ" value={`${identity.projectCode} / ${identity.projectName}`} />
                    <InfoRow label="ภารกิจ" value={identity.missionName} />
                    <InfoRow label="สถานะงาน" value={formatStatusTh(identity.assignmentStatus)} />
                    <InfoRow label="อัปเดตล่าสุด" value={hydrated ? getAgeLabel(location, effectiveNow) : "กำลังตรวจ"} />
                  </dl>
                  <p className="mt-2 text-xs">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    {location.accuracy ? ` / ความแม่นยำ ${Math.round(location.accuracy)} เมตร` : ""}
                  </p>
                  <a className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-white/80 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" href={buildGoogleMapsUrl(location)} rel="noreferrer" target="_blank">
                    เปิดตำแหน่งใน Google Maps
                  </a>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
              ยังไม่มีข้อมูลตำแหน่งสำหรับโครงการนี้ หากกำลังทดสอบ ให้เปิดหน้าคนขับบนมือถือและอนุญาตการเข้าถึงตำแหน่ง
            </div>
          )}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="font-semibold">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
