"use client";

import type { DriverLocation } from "@tomp/types/domain";

function metadataText(location: DriverLocation, key: string, fallback: string) {
  const value = location.metadata[key];
  return typeof value === "string" && value.trim() ? value : fallback;
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

function mapUrl(locations: DriverLocation[]) {
  const latest = locations[0];
  const centerLatitude = latest?.latitude ?? 13.7563;
  const centerLongitude = latest?.longitude ?? 100.5018;
  const delta = 0.025;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${centerLongitude - delta}%2C${centerLatitude - delta}%2C${centerLongitude + delta}%2C${centerLatitude + delta}&layer=mapnik`;
}

export function VehicleFleetMap({ locations }: { locations: DriverLocation[] }) {
  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-blue-200">แผนที่รวมรถ</p>
          <h2 className="mt-1 text-lg font-semibold">ตำแหน่ง GPS ล่าสุดของรถหลายคัน</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">ตำแหน่งผูกกับโครงการ Assignment คนขับ และรถจากข้อมูลจริงในระบบ</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{locations.length} จุดล่าสุด</span>
      </div>
      <div className="relative min-h-[420px] overflow-hidden bg-slate-100">
        <iframe className="h-[420px] w-full border-0 opacity-85" loading="lazy" referrerPolicy="no-referrer" src={mapUrl(locations)} title="แผนที่รวมรถ" />
        {locations.map((location) => {
          const position = getMarkerPosition(location, locations);
          const callSign = metadataText(location, "callSign", "ไม่พบ Call Sign");
          const vehiclePlate = metadataText(location, "vehiclePlate", "ไม่พบทะเบียน");
          const driverName = metadataText(location, "driverName", "ไม่พบชื่อคนขับ");
          return (
            <a
              key={location.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
              rel="noreferrer"
              style={position}
              target="_blank"
              title={`${vehiclePlate} / ${driverName}`}
            >
              <span className="absolute inline-flex h-8 w-8 -translate-x-2 -translate-y-2 animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative block h-4 w-4 rounded-full bg-emerald-500 ring-8 ring-emerald-200" />
              <span className="absolute left-5 top-0 min-w-44 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-soft">
                <span className="block font-semibold text-ink">{vehiclePlate}</span>
                <span className="block text-slate-600">{callSign} / {driverName}</span>
              </span>
            </a>
          );
        })}
        {!locations.length ? (
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm text-slate-600 shadow-soft">
            ยังไม่มีตำแหน่ง GPS จากรถในระบบ เมื่อคนขับเปิดงานและยินยอมแชร์ GPS หมุดรถจะแสดงบนแผนที่นี้
          </div>
        ) : null}
      </div>
    </section>
  );
}
