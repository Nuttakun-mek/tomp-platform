"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

type ShareState = "idle" | "requesting" | "sharing" | "paused" | "error";
type TrackingEvent = "sharing_started" | "location_ping" | "sharing_stopped";

interface LastLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  sentAt: string;
}

interface WakeLockSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

function buildOsmEmbedUrl(location: LastLocation) {
  const delta = 0.01;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - delta}%2C${location.latitude - delta}%2C${location.longitude + delta}%2C${location.latitude + delta}&layer=mapnik&marker=${location.latitude}%2C${location.longitude}`;
}

function buildGoogleMapsUrl(location: LastLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function getWakeLockApi() {
  return "wakeLock" in navigator
    ? (navigator.wakeLock as { request: (type: "screen") => Promise<WakeLockSentinel> })
    : null;
}

export function DriverLocationShare({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const [state, setState] = useState<ShareState>("idle");
  const [message, setMessage] = useState("ยังไม่ได้แชร์ตำแหน่ง");
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [wakeLockStatus, setWakeLockStatus] = useState<"unsupported" | "active" | "released" | "error">("unsupported");
  const watchIdRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const lastLocationRef = useRef<LastLocation | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  async function requestWakeLock() {
    const wakeLock = getWakeLockApi();
    if (!wakeLock) {
      setWakeLockStatus("unsupported");
      return;
    }

    try {
      wakeLockRef.current = await wakeLock.request("screen");
      setWakeLockStatus("active");
      wakeLockRef.current.addEventListener("release", () => setWakeLockStatus("released"));
    } catch {
      setWakeLockStatus("error");
    }
  }

  async function releaseWakeLock() {
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      await wakeLockRef.current.release().catch(() => undefined);
    }
    wakeLockRef.current = null;
    setWakeLockStatus(getWakeLockApi() ? "released" : "unsupported");
  }

  const postLocation = useCallback(async (location: LastLocation, trackingEvent: TrackingEvent) => {
    const response = await fetch("/api/driver/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: driverAccess.token,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        recordedAt: location.recordedAt,
        trackingEvent,
        metadata: {
          assignmentId: driverAccess.assignment.id,
          projectId: driverAccess.project.id,
          callSign: driverAccess.callSign.callSign,
          driverName: driverAccess.driver.fullName,
          vehiclePlate: driverAccess.vehicle.plateNumber
        }
      })
    });
    const result = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !result.success) {
      throw new Error(result.error || "ส่งตำแหน่งไม่สำเร็จ");
    }
  }, [driverAccess.assignment.id, driverAccess.callSign.callSign, driverAccess.driver.fullName, driverAccess.project.id, driverAccess.token, driverAccess.vehicle.plateNumber]);

  const sendPosition = useCallback(async (position: GeolocationPosition, trackingEvent: TrackingEvent) => {
    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
      recordedAt: new Date(position.timestamp).toISOString(),
      sentAt: new Date().toLocaleTimeString("th-TH")
    };

    await postLocation(location, trackingEvent);
    lastLocationRef.current = location;
    setLastLocation(location);
    setMessage("ส่งตำแหน่งล่าสุดไปยังศูนย์ควบคุมแล้ว");
  }, [postLocation]);

  const requestCurrentPosition = useCallback((trackingEvent: TrackingEvent) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await sendPosition(position, trackingEvent);
          setState("sharing");
        } catch (error) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "ส่งตำแหน่งไม่สำเร็จ");
        }
      },
      (error) => {
        setState("error");
        setMessage(error.message || "ไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, [sendPosition]);

  function startSharing() {
    if (!("geolocation" in navigator)) {
      setState("error");
      setMessage("เครื่องนี้ไม่รองรับการแชร์ตำแหน่ง");
      return;
    }

    setState("requesting");
    setMessage("กำลังขอสิทธิ์เข้าถึงตำแหน่ง กรุณากดอนุญาตบน browser");
    void requestWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const event = startedRef.current ? "location_ping" : "sharing_started";
          startedRef.current = true;
          setState("sharing");
          await sendPosition(position, event);
        } catch (error) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "ส่งตำแหน่งไม่สำเร็จ");
        }
      },
      (error) => {
        setState("error");
        setMessage(error.message || "ไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  async function stopSharing() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    startedRef.current = false;

    if (lastLocationRef.current) {
      await postLocation(lastLocationRef.current, "sharing_stopped").catch(() => undefined);
    }
    await releaseWakeLock();
    setState("idle");
    setMessage("หยุดแชร์ตำแหน่งแล้ว");
  }

  useEffect(() => {
    if (state !== "sharing" && state !== "paused") return undefined;

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible" && lastLocationRef.current) {
        void postLocation(
          {
            ...lastLocationRef.current,
            recordedAt: new Date().toISOString(),
            sentAt: new Date().toLocaleTimeString("th-TH")
          },
          "location_ping"
        ).then(() => {
          const updated = lastLocationRef.current
            ? { ...lastLocationRef.current, recordedAt: new Date().toISOString(), sentAt: new Date().toLocaleTimeString("th-TH") }
            : null;
          if (updated) {
            lastLocationRef.current = updated;
            setLastLocation(updated);
          }
        });
      }
    }, 15000);

    return () => window.clearInterval(heartbeat);
  }, [postLocation, state]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (!startedRef.current) return;

      if (document.visibilityState === "hidden") {
        setState("paused");
        setMessage("แอปถูกซ่อนไว้ ระบบมือถืออาจหยุดส่ง GPS ชั่วคราว กรุณากลับมาหน้านี้ระหว่างแชร์ตำแหน่ง");
        return;
      }

      void requestWakeLock();
      setMessage("กลับมาที่หน้าแชร์ตำแหน่งแล้ว กำลังอัปเดตตำแหน่งล่าสุด");
      requestCurrentPosition("location_ping");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [requestCurrentPosition]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      void releaseWakeLock();
    };
  }, []);

  const isSharing = state === "sharing" || state === "requesting" || state === "paused";
  const mapUrl = useMemo(() => (lastLocation ? buildOsmEmbedUrl(lastLocation) : null), [lastLocation]);
  const wakeLockText =
    wakeLockStatus === "active"
      ? "เปิดโหมดกันจอดับแล้ว"
      : wakeLockStatus === "unsupported"
        ? "Browser นี้ไม่รองรับโหมดกันจอดับ"
        : wakeLockStatus === "error"
          ? "เปิดโหมดกันจอดับไม่สำเร็จ"
          : "โหมดกันจอดับถูกปล่อยแล้ว";

  return (
    <section className="overflow-hidden rounded-md border border-blue-200 bg-white shadow-soft">
      <div className="bg-blue-700 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-100">แชร์ตำแหน่ง GPS</p>
            <h3 className="mt-1 text-2xl font-semibold">ให้ศูนย์ควบคุมเห็นตำแหน่งรถ</h3>
            <p className="mt-2 text-sm leading-6 text-blue-50">
              Web app จะส่งตำแหน่งต่อเนื่องขณะหน้านี้ยังทำงานอยู่ หากสลับแอปหรือล็อกจอ ระบบมือถืออาจหยุดส่งชั่วคราว
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">
            {state === "sharing" ? "กำลังแชร์" : state === "requesting" ? "กำลังขอสิทธิ์" : state === "paused" ? "แอปถูกซ่อน" : state === "error" ? "ต้องตรวจสอบ" : "ยังไม่แชร์"}
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="p-5">
          <div className={`rounded-md p-4 text-sm ${state === "paused" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-slate-700"}`}>
            <p className="font-medium text-slate-900">{message}</p>
            <p className="mt-2 text-xs font-semibold">{wakeLockText}</p>
            {lastLocation ? (
              <div className="mt-2 space-y-1 text-sm">
                <p>ล่าสุด {lastLocation.sentAt}</p>
                <p>ความแม่นยำ {lastLocation.accuracy ? Math.round(lastLocation.accuracy) : "-"} เมตร</p>
                <p className="text-xs text-slate-500">
                  {lastLocation.latitude.toFixed(6)}, {lastLocation.longitude.toFixed(6)}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">กดปุ่มเริ่มแชร์ แล้วอนุญาตตำแหน่งบนมือถือ</p>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            <button
              className="min-h-14 rounded-md bg-blue-700 px-4 py-3 text-base font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSharing}
              type="button"
              onClick={startSharing}
            >
              เริ่มแชร์ตำแหน่ง
            </button>
            <button
              className="min-h-14 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 shadow-sm disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={!isSharing}
              type="button"
              onClick={() => void stopSharing()}
            >
              หยุดแชร์ตำแหน่ง
            </button>
          </div>

          {lastLocation ? (
            <a
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800"
              href={buildGoogleMapsUrl(lastLocation)}
              rel="noreferrer"
              target="_blank"
            >
              เปิดตำแหน่งของฉันใน Google Maps
            </a>
          ) : null}
        </div>

        <div className="min-h-[260px] border-t border-slate-200 bg-slate-100 lg:border-l lg:border-t-0">
          {mapUrl ? (
            <iframe
              className="h-[300px] w-full border-0 lg:h-full lg:min-h-[360px]"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={mapUrl}
              title="แผนที่ตำแหน่งล่าสุดของคนขับ"
            />
          ) : (
            <div className="flex min-h-[260px] items-center justify-center p-6 text-center">
              <div>
                <p className="font-semibold text-ink">แผนที่จะแสดงหลังเริ่มแชร์ GPS</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">เมื่อ browser ได้รับตำแหน่ง ระบบจะแสดงตำแหน่งล่าสุดบนหน้านี้ทันที</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
