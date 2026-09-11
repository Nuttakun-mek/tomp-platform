"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CarFront, Eye, Navigation } from "lucide-react";
import type { FleetView as FleetViewData } from "@/lib/data/fleet-view";
import type { LocaleCode } from "@/lib/i18n/locales";
import { gpsFreshnessLabel } from "@/lib/domain/gps-freshness";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { FleetLegend } from "./fleet-legend";
import { LiveTrackingMap, type TrackedPoint } from "@/components/mission-control/live-tracking-map";

function formatTime(value: string | null, locale: LocaleCode) {
  if (!value) return locale === "th" ? "ยังไม่ระบุ" : "Not specified";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

const copy = {
  th: {
    title: "ติดตามรถในโครงการ",
    subtitle: "มุมมองอ่านอย่างเดียวสำหรับผู้ติดตามภายนอก แสดงรถที่ได้รับอนุญาตในโครงการนี้เท่านั้น",
    readOnly: "อ่านอย่างเดียว",
    vehicles: "รถในโครงการ",
    liveMap: "แผนที่สถานะรถ",
    noPosition: "ยังไม่มีตำแหน่ง",
    destination: "จุดหมาย",
    noDestination: "ยังไม่ระบุจุดหมาย",
    lastUpdate: "อัปเดตล่าสุด",
    vehicle: "รถ",
    vehicleMissing: "ยังไม่ระบุรถ",
    crewHidden: "ซ่อนชื่อคนขับ",
    driver: "คนขับ",
    contact: "ติดต่อศูนย์ควบคุม"
  },
  en: {
    title: "Project Fleet Tracking",
    subtitle: "Read-only customer view. Only vehicles allowed by this project link are shown.",
    readOnly: "Read only",
    vehicles: "Vehicles",
    liveMap: "Live Map",
    noPosition: "No position yet",
    destination: "Destination",
    noDestination: "Not specified",
    lastUpdate: "Last update",
    vehicle: "Vehicle",
    vehicleMissing: "Vehicle not assigned",
    crewHidden: "Driver hidden",
    driver: "Driver",
    contact: "Contact Control"
  }
} as const;

export function FleetView({ view, locale }: { view: FleetViewData; locale: LocaleCode }) {
  const router = useRouter();
  const c = copy[locale];

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer && document.visibilityState === "visible") {
        timer = setInterval(() => router.refresh(), 30_000);
      }
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  const points = useMemo<TrackedPoint[]>(
    () =>
      view.units
        .filter((unit) => unit.latitude !== null && unit.longitude !== null)
        .map((unit) => ({
          id: unit.callSignId,
          latitude: unit.latitude!,
          longitude: unit.longitude!,
          freshness: unit.freshness,
          title: unit.callSign,
          subtitle: `${unit.vehicle?.plateNumber ?? c.vehicleMissing} · ${unit.destination ?? c.noDestination}`,
          ageLabel: gpsFreshnessLabel(unit.freshness, locale),
          accuracy: unit.accuracy
        })),
    [c.noDestination, c.vehicleMissing, locale, view.units]
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_32rem),linear-gradient(180deg,#f8fafc,#eef2f7)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-xl shadow-slate-300/30 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-700">TOMP</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{c.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{c.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800">
                <Eye className="h-4 w-4" /> {c.readOnly}
              </span>
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold text-slate-300">{view.project.code}</p>
              <p className="mt-1 text-lg font-bold">{view.project.name}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">{c.vehicles}</p>
              <p className="mt-1 text-3xl font-bold">{view.units.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">GPS</p>
              <p className="mt-1 text-3xl font-bold">{points.length}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{c.liveMap}</p>
                <h2 className="mt-1 text-xl font-bold">{view.project.name}</h2>
              </div>
              <Navigation className="h-5 w-5 text-teal-700" />
            </div>
            {points.length ? (
              <LiveTrackingMap points={points} height={560} />
            ) : (
              <div className="grid h-[560px] place-items-center bg-slate-50 text-sm font-semibold text-slate-500">{c.noPosition}</div>
            )}
          </div>

          <aside className="space-y-4">
            <FleetLegend locale={locale} />
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-300/30">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{c.vehicles}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{view.units.length}</span>
              </div>
              <div className="mt-4 grid gap-3">
                {view.units.map((unit) => (
                  <article key={unit.callSignId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">Call Sign</p>
                        <h3 className="mt-1 text-2xl font-bold">{unit.callSign}</h3>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{gpsFreshnessLabel(unit.freshness, locale)}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <p className="flex items-center gap-2 font-semibold">
                        <CarFront className="h-4 w-4 text-slate-500" />
                        {unit.vehicle ? `${unit.vehicle.plateNumber} · ${unit.vehicle.vehicleType}` : c.vehicleMissing}
                      </p>
                      {unit.vehicle?.colour ? <p>{unit.vehicle.colour}</p> : null}
                      <p>
                        {c.destination}: <span className="font-semibold">{unit.destination ?? c.noDestination}</span>
                      </p>
                      <p>
                        {c.lastUpdate}: <span className="font-semibold">{formatTime(unit.recordedAt, locale)}</span>
                      </p>
                      <p>{view.showCrew && unit.driverName ? `${c.driver}: ${unit.driverName}` : c.crewHidden}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
