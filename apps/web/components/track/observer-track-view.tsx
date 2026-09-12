"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CarFront, Clock3, Eye, MapPin, Navigation, Route, ShieldCheck } from "lucide-react";
import type { ObserverAccessView } from "@/lib/data/observer-access";
import { gpsFreshness, gpsFreshnessLabel } from "@/lib/domain/gps-freshness";
import { formatRelativeTh } from "@/lib/format/relative-time-th";
import { formatDateTime, formatStatus } from "@/lib/i18n/format";
import type { LocaleCode } from "@/lib/i18n/locales";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LiveTrackingMap, TRACKING_MARKER_COLORS, type TrackedPoint } from "@/components/mission-control/live-tracking-map";

function fallback(locale: LocaleCode, th: string, en: string) {
  return locale === "en" ? en : th;
}

function formatTime(value: string | null, locale: LocaleCode) {
  if (!value) return fallback(locale, "ยังไม่มีข้อมูล", "No data yet");
  return formatDateTime(value, locale);
}

function formatAge(value: string | null, locale: LocaleCode, now: number) {
  if (!value) return fallback(locale, "ยังไม่มีข้อมูล", "No data yet");
  if (!now) return formatTime(value, locale);
  return locale === "th" ? formatRelativeTh(value, now) : formatTime(value, locale);
}

function hasCoordinate(location: ObserverAccessView["location"]): location is NonNullable<ObserverAccessView["location"]> & { latitude: number; longitude: number } {
  return Boolean(location && location.latitude !== null && location.longitude !== null && Number.isFinite(location.latitude) && Number.isFinite(location.longitude));
}

export function ObserverTrackView({ view, locale, serverNow }: { view: ObserverAccessView; locale: LocaleCode; serverNow: number }) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 10_000);
    let refresh: ReturnType<typeof setInterval> | null = null;

    const startRefresh = () => {
      if (!refresh && document.visibilityState === "visible") {
        refresh = setInterval(() => router.refresh(), 30_000);
      }
    };
    const stopRefresh = () => {
      if (refresh) clearInterval(refresh);
      refresh = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        startRefresh();
      } else {
        stopRefresh();
      }
    };

    startRefresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(clock);
      stopRefresh();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  const freshness = hasCoordinate(view.location) ? gpsFreshness(view.location.recordedAt, view.location.status, now, view.location.metadata) : "offline";
  const ageLabel = formatAge(view.location?.recordedAt ?? null, locale, now);
  const mapsUrl = hasCoordinate(view.location)
    ? `https://www.google.com/maps/search/?api=1&query=${view.location.latitude},${view.location.longitude}`
    : null;
  const coordinateText = hasCoordinate(view.location)
    ? `${view.location.latitude.toFixed(6)}, ${view.location.longitude.toFixed(6)}`
    : fallback(locale, "ยังไม่มีข้อมูล", "No data yet");

  const points = useMemo<TrackedPoint[]>(() => {
    const location = view.location;
    if (!hasCoordinate(location)) return [];
    return [
      {
        id: view.callSign.id,
        latitude: location.latitude,
        longitude: location.longitude,
        freshness,
        title: `Call Sign ${view.callSign.label}`,
        subtitle: `${view.vehicle?.plateNumber ?? fallback(locale, "ยังไม่ระบุรถ", "Vehicle not assigned")} · ${view.project.name}`,
        ageLabel,
        accuracy: location.accuracy
      }
    ];
  }, [ageLabel, freshness, locale, view]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dff7f2,transparent_28rem),linear-gradient(180deg,#f8fafc,#eef4f7)] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-4">
        <header className="overflow-hidden rounded-[28px] border border-white/70 bg-command text-white shadow-command">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">TOMP</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Call Sign {view.callSign.label}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
                {view.project.name} · {view.project.code}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm font-bold"
                style={{ backgroundColor: `${TRACKING_MARKER_COLORS[freshness]}24`, color: freshness === "offline" ? "#fecdd3" : "#ccfbf1" }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TRACKING_MARKER_COLORS[freshness] }} />
                {gpsFreshnessLabel(freshness, locale)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-teal-100">
                <ShieldCheck className="h-4 w-4" />
                {fallback(locale, "อ่านอย่างเดียว", "Read only")}
              </span>
              <LanguageSwitcher locale={locale} variant="dark" />
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{fallback(locale, "แผนที่ติดตามสถานะ", "Live tracking map")}</p>
                <h2 className="mt-1 text-xl font-black">{fallback(locale, "ตำแหน่งล่าสุดของรถ", "Latest vehicle position")}</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                <Clock3 className="h-3.5 w-3.5" />
                {fallback(locale, "ล่าสุด", "Latest")} {ageLabel}
              </span>
            </div>
            {points.length ? (
              <LiveTrackingMap points={points} height={520} />
            ) : (
              <div className="grid min-h-[420px] place-items-center bg-slate-50 p-8 text-center">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-200 text-slate-500">
                    <MapPin className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 text-lg font-black">{fallback(locale, "ยังไม่มีตำแหน่งล่าสุด", "No latest position yet")}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                    {fallback(locale, "รอให้คนขับเริ่มส่งตำแหน่ง GPS จากแอปคนขับหรือหน้าเว็บคนขับ", "Waiting for the driver to start sending GPS from the driver app or driver web page.")}
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className="grid gap-4 content-start">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-300/25">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black">{fallback(locale, "สถานะรถ", "Vehicle status")}</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{formatStatus(view.assignment?.status || "planned", locale)}</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-700">
                <p className="flex items-start gap-2">
                  <CarFront className="mt-0.5 h-4 w-4 text-slate-500" />
                  <span>
                    <span className="block text-xs font-bold text-slate-500">{fallback(locale, "ทะเบียน / ประเภทรถ", "Plate / type")}</span>
                    <span className="font-bold">{view.vehicle?.plateNumber || fallback(locale, "ยังไม่ระบุ", "Not specified")}</span>
                    <span className="text-slate-500"> · {view.vehicle?.vehicleType || fallback(locale, "ยังไม่ระบุ", "Not specified")}</span>
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />
                  <span>
                    <span className="block text-xs font-bold text-slate-500">{fallback(locale, "พิกัดล่าสุด", "Latest coordinate")}</span>
                    <span className="font-bold">{coordinateText}</span>
                  </span>
                </p>
                {mapsUrl ? (
                  <Link href={mapsUrl} target="_blank" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-command bg-route px-4 text-sm font-black text-white shadow-sm">
                    <Navigation className="h-4 w-4" />
                    {fallback(locale, "เปิดบน Google Maps", "Open in Google Maps")}
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-300/25">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-teal-700" />
                <p className="text-sm font-black">{fallback(locale, "งานที่กำลังติดตาม", "Tracked assignment")}</p>
              </div>
              {view.assignment ? (
                <div className="mt-4 grid gap-3 text-sm text-slate-700">
                  <p>
                    <span className="block text-xs font-bold text-slate-500">{fallback(locale, "จุดรับ", "Pickup")}</span>
                    <span className="font-semibold">{view.assignment.pickup}</span>
                  </p>
                  <p>
                    <span className="block text-xs font-bold text-slate-500">{fallback(locale, "จุดส่ง", "Drop-off")}</span>
                    <span className="font-semibold">{view.assignment.dropoff}</span>
                  </p>
                  <p>
                    <span className="block text-xs font-bold text-slate-500">{fallback(locale, "เวลาเริ่มงาน", "Start time")}</span>
                    <span className="font-semibold">{formatTime(view.assignment.startTime, locale)}</span>
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600">{fallback(locale, "ยังไม่มีงานที่เปิดให้ติดตาม", "No assignment is open for tracking yet.")}</p>
              )}
            </section>

            <section className="rounded-[28px] border border-teal-100 bg-teal-50/80 p-5 text-sm leading-6 text-teal-950">
              <div className="flex items-start gap-3">
                <Eye className="mt-1 h-4 w-4 shrink-0 text-teal-700" />
                <p>
                  {fallback(
                    locale,
                    "หน้านี้อัปเดตอัตโนมัติเมื่อเปิดค้างไว้ ข้อมูลใช้สำหรับติดตามสถานะเท่านั้น หากต้องการเปลี่ยนแผนโปรดติดต่อศูนย์ควบคุม",
                    "This page refreshes automatically while visible. It is for status tracking only; contact the control room to request changes."
                  )}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
