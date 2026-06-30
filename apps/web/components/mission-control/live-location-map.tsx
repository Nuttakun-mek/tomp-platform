"use client";

import { useEffect, useMemo, useState } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import { subscribeToDriverLocations, unsubscribeMissionControl } from "@/lib/realtime/mission-control";

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
    assignmentStatus: metadataText(location, "assignmentStatus", "กำลังติดตาม")
  };
}

function getFreshness(location: DriverLocation, now = Date.now()): LocationFreshness {
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

function getAgeLabel(location: DriverLocation, now = Date.now()) {
  const ageSeconds = Math.max(0, Math.round((now - new Date(location.recordedAt).getTime()) / 1000));
  if (ageSeconds < 60) return `${ageSeconds} วินาทีที่แล้ว`;
  return `${Math.round(ageSeconds / 60)} นาทีที่แล้ว`;
}

function buildOsmEmbedUrl(location: DriverLocation) {
  const { latitude, longitude } = location;
  const delta = 0.012;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}&layer=mapnik`;
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
  const x = 12 + ((location.longitude - minLng) / lngRange) * 76;
  const y = 12 + ((maxLat - location.latitude) / latRange) * 76;
  return { left: `${x}%`, top: `${y}%` };
}

export function LiveLocationMap({ projectId, initialLocations }: LiveLocationMapProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [connection, setConnection] = useState<"live" | "fallback" | "offline">("fallback");
  const [now, setNow] = useState(Date.now());
  const latest = locations[0];

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      try {
        const response = await fetch(`/api/mission-control/locations?projectId=${projectId}`, { cache: "no-store" });
        const result = (await response.json()) as { data?: DriverLocation[] };
        if (mounted && result.data) {
          setLocations(result.data);
          setNow(Date.now());
          setConnection((current) => (current === "live" ? "live" : "fallback"));
        }
      } catch {
        if (mounted) setConnection("offline");
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

  const mapUrl = useMemo(() => (latest ? buildOsmEmbedUrl(latest) : null), [latest]);
  const liveCount = locations.filter((location) => getFreshness(location, now) === "live").length;
  const issueCount = locations.filter((location) => ["slow", "offline", "stopped"].includes(getFreshness(location, now))).length;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">แผนที่ติดตามสถานะ</p>
            <h2 className="mt-1 text-xl font-semibold">ตำแหน่งคนขับแบบเรียลไทม์</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-200">
              ทุกตำแหน่งผูกกับ Project, Assignment, Call Sign, คนขับ และรถจากฐานข้อมูลจริง สีของหมุดแสดงความสดของสัญญาณ GPS ล่าสุด
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
            {connection === "live" ? "เชื่อมต่อสด" : connection === "offline" ? "ออฟไลน์" : "สำรองด้วยการดึงข้อมูล"}
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="min-h-[420px] bg-slate-100">
          {mapUrl && latest ? (
            <div className="relative h-full min-h-[420px] overflow-hidden">
              <iframe
                className="h-[420px] w-full border-0 opacity-80 lg:h-full lg:min-h-[560px]"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={mapUrl}
                title="แผนที่ตำแหน่งคนขับ"
              />

              {locations.map((location) => {
                const status = getFreshness(location, now);
                const identity = getLocationIdentity(location);
                const position = getMarkerPosition(location, locations);
                return (
                  <div key={location.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={position}>
                    {status === "live" ? <span className="absolute inline-flex h-8 w-8 -translate-x-2 -translate-y-2 animate-ping rounded-full bg-emerald-400 opacity-60" /> : null}
                    <a
                      className={`relative flex h-4 w-4 rounded-full ring-8 ${getMarkerClass(status)}`}
                      href={buildGoogleMapsUrl(location)}
                      rel="noreferrer"
                      target="_blank"
                      title={`${identity.callSign} - ${identity.driverName}`}
                    />
                    <div className="absolute left-5 top-0 min-w-40 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-soft">
                      <p className="font-semibold text-ink">{identity.callSign}</p>
                      <p className="text-slate-600">{identity.driverName}</p>
                      <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 font-semibold ${getFreshnessClass(status)}`}>{getFreshnessLabel(status)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center p-6 text-center">
              <div className="max-w-md rounded-md border border-dashed border-slate-300 bg-white p-6">
                <p className="text-lg font-semibold text-ink">ยังไม่มีตำแหน่งคนขับจริง</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  เปิดหน้าคนขับด้วยลิงก์ QR แล้วกดเริ่มแชร์ตำแหน่ง GPS แผนที่จะแสดงหมุดและสถานะอัตโนมัติ
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid content-start gap-3 border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">ทั้งหมด</p>
              <p className="mt-1 text-xl font-semibold text-ink">{locations.length}</p>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-800">กำลังแชร์</p>
              <p className="mt-1 text-xl font-semibold text-emerald-950">{liveCount}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">ต้องติดตาม</p>
              <p className="mt-1 text-xl font-semibold text-amber-950">{issueCount}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">รายการตำแหน่งล่าสุด</p>
            <p className="text-xs text-slate-500">แยกตาม Assignment เพื่อให้รู้ว่าใครอยู่ในงานใด</p>
          </div>

          {locations.length ? (
            locations.map((location) => {
              const identity = getLocationIdentity(location);
              const status = getFreshness(location, now);
              return (
                <article key={location.id} className={`rounded-md border p-4 ${getFreshnessClass(status)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{identity.callSign}</p>
                      <p className="text-sm">{identity.driverName}</p>
                    </div>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">{getFreshnessLabel(status)}</span>
                  </div>
                  <dl className="mt-3 grid gap-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="font-semibold">Project</dt>
                      <dd className="text-right">{identity.projectCode}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="font-semibold">ภารกิจ</dt>
                      <dd className="text-right">{identity.missionName}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="font-semibold">รถ</dt>
                      <dd className="text-right">{identity.vehiclePlate}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="font-semibold">อัปเดตล่าสุด</dt>
                      <dd className="text-right">{getAgeLabel(location, now)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    {location.accuracy ? ` | ความแม่นยำ ${Math.round(location.accuracy)} เมตร` : ""}
                  </p>
                  <a
                    className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-white/80 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
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
