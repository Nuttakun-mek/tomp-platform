"use client";

import { buildLocationPingPayload, evaluateLocationHealth } from "@tomp/driver-core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { LiveTrackingMap, type TrackedPoint } from "@/components/mission-control/live-tracking-map";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

type ShareState = "idle" | "requesting" | "sharing" | "stale" | "error";
type TrackingEvent = "sharing_started" | "location_ping" | "sharing_stopped";
type LocationSignal = "off" | "live" | "stale";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface TompMobileShell {
  namespace: "tomp.driver";
  version: 1;
  canBackgroundLocation?: boolean;
  postMessage: (message: unknown) => void;
}

declare global {
  interface Window {
    TOMP_MOBILE_SHELL?: TompMobileShell;
  }
}

interface LastLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  sentAt: string;
}

interface DriverLocationShareProps {
  driverAccess: DriverAccessAssignment;
  onStatusChange?: (status: LocationSignal) => void;
}

function buildGoogleMapsUrl(location: LastLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function consentKey(token: string) {
  return `tomp:gps-consent:${token}`;
}

function getMobileShell() {
  const shell = window.TOMP_MOBILE_SHELL;
  return shell?.namespace === "tomp.driver" && shell.version === 1 ? shell : null;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

export function DriverLocationShare({ driverAccess, onStatusChange }: DriverLocationShareProps) {
  const [state, setState] = useState<ShareState>("idle");
  const [message, setMessage] = useState("ยังไม่ได้แชร์ตำแหน่ง");
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const [cardOpen, setCardOpen] = useState(true);
  const [canResume, setCanResume] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const lastLocationRef = useRef<LastLocation | null>(null);
  const staleTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const setSignal = useCallback(
    (signal: LocationSignal) => {
      onStatusChange?.(signal);
      if (signal === "stale" && watchIdRef.current != null) setState("stale");
    },
    [onStatusChange]
  );

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock || wakeLockRef.current) return;
    try {
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) await lock.release().catch(() => undefined);
  }, []);

  const markFresh = useCallback(
    (location: LastLocation) => {
      lastLocationRef.current = location;
      setLastLocation(location);
      setState("sharing");
      setMessage("ส่งตำแหน่งล่าสุดให้ศูนย์ควบคุมแล้ว");
      setSignal("live");
      if (staleTimerRef.current != null) window.clearTimeout(staleTimerRef.current);
      staleTimerRef.current = window.setTimeout(() => {
        setMessage("ยังเปิดแชร์ GPS อยู่ แต่ไม่มีพิกัดใหม่เกิน 45 วินาที");
        setSignal("stale");
      }, 45000);
    },
    [setSignal]
  );

  const postLocation = useCallback(
    async (location: LastLocation, trackingEvent: TrackingEvent) => {
      const ping = buildLocationPingPayload({
        projectId: driverAccess.project.id,
        assignmentId: driverAccess.assignment.id,
        driverId: driverAccess.driver.id,
        vehicleId: driverAccess.vehicle.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        recordedAt: location.recordedAt,
        source: "driver_web_app",
        metadata: { callSign: driverAccess.callSign.callSign, trackingEvent }
      });

      const response = await fetch("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: ping.latitude,
          longitude: ping.longitude,
          accuracy: ping.accuracy,
          recordedAt: ping.recordedAt,
          trackingEvent,
          metadata: {
            assignmentId: ping.assignmentId,
            projectId: ping.projectId,
            projectCode: driverAccess.project.projectCode,
            projectName: driverAccess.project.projectName,
            callSign: driverAccess.callSign.callSign,
            driverName: driverAccess.driver.fullName,
            driverPhone: driverAccess.driver.phone,
            vehiclePlate: driverAccess.vehicle.plateNumber,
            assignmentStatus: driverAccess.assignment.status
          }
        })
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "ส่งตำแหน่งไม่สำเร็จ");
    },
    [driverAccess]
  );

  const sendPosition = useCallback(
    async (position: GeolocationPosition, trackingEvent: TrackingEvent) => {
      const location: LastLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
        recordedAt: new Date(position.timestamp).toISOString(),
        sentAt: new Date().toISOString()
      };
      await postLocation(location, trackingEvent);
      markFresh(location);
    },
    [markFresh, postLocation]
  );

  const startSharing = useCallback(async () => {
    if (watchIdRef.current != null) return;
    const shell = getMobileShell();
    if (shell?.canBackgroundLocation) {
      window.localStorage.setItem(consentKey(driverAccess.token), "1");
      setCanResume(true);
      setState("requesting");
      setMessage("กำลังขอให้แอป TOMP Driver เริ่มแชร์ตำแหน่ง");
      shell.postMessage({
        namespace: "tomp.driver",
        version: 1,
        type: "gps.start",
        payload: { reason: "driver_requested" }
      });
      return;
    }

    if (!("geolocation" in navigator)) {
      setState("error");
      setSignal("off");
      setMessage("อุปกรณ์นี้ไม่รองรับการแชร์ตำแหน่ง");
      return;
    }

    window.localStorage.setItem(consentKey(driverAccess.token), "1");
    setCanResume(true);
    setState("requesting");
    setMessage("กำลังขอสิทธิ์เข้าถึงตำแหน่ง กรุณากดอนุญาต");
    await requestWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const event = startedRef.current ? "location_ping" : "sharing_started";
          startedRef.current = true;
          await sendPosition(position, event);
        } catch (error) {
          setState("error");
          setSignal("stale");
          setMessage(error instanceof Error ? error.message : "ส่งตำแหน่งไม่สำเร็จ");
        }
      },
      (error) => {
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        startedRef.current = false;
        setState("error");
        setSignal("off");
        setMessage(error.message || "ไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, [driverAccess.token, requestWakeLock, sendPosition, setSignal]);

  const stopSharing = useCallback(async () => {
    const shell = getMobileShell();
    if (shell?.canBackgroundLocation) {
      shell.postMessage({
        namespace: "tomp.driver",
        version: 1,
        type: "gps.stop",
        payload: { reason: "driver_requested" }
      });
      window.localStorage.removeItem(consentKey(driverAccess.token));
      setCanResume(false);
      setState("idle");
      setSignal("off");
      setMessage("ส่งคำสั่งหยุดแชร์ตำแหน่งไปยังแอปแล้ว");
      return;
    }

    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    startedRef.current = false;
    window.localStorage.removeItem(consentKey(driverAccess.token));
    setCanResume(false);
    if (staleTimerRef.current != null) window.clearTimeout(staleTimerRef.current);
    staleTimerRef.current = null;
    if (lastLocationRef.current) {
      await postLocation(lastLocationRef.current, "sharing_stopped").catch(() => undefined);
    }
    await releaseWakeLock();
    setState("idle");
    setSignal("off");
    setMessage("หยุดแชร์ตำแหน่งแล้ว");
  }, [driverAccess.token, postLocation, releaseWakeLock, setSignal]);

  useEffect(() => {
    const handleNativeStatus = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        payload?: {
          status?: string;
          message?: string;
          detail?: {
            latitude?: number;
            longitude?: number;
            accuracy?: number | null;
            recordedAt?: string;
          };
        };
      };
      const payload = detail?.payload;
      if (!payload?.status) return;

      if (payload.message) setMessage(payload.message);
      if (payload.status === "gps_sharing") {
        const locationDetail = payload.detail;
        if (typeof locationDetail?.latitude === "number" && typeof locationDetail.longitude === "number") {
          markFresh({
            latitude: locationDetail.latitude,
            longitude: locationDetail.longitude,
            accuracy: locationDetail.accuracy ?? null,
            recordedAt: locationDetail.recordedAt || new Date().toISOString(),
            sentAt: new Date().toISOString()
          });
        } else {
          setState("sharing");
          setSignal("live");
        }
      }
      if (payload.status === "gps_stopped") {
        setState("idle");
        setSignal("off");
      }
      if (payload.status === "gps_error" || payload.status === "session_missing") {
        setState("error");
        setSignal("off");
      }
    };

    window.addEventListener("tomp:native-status", handleNativeStatus);
    return () => window.removeEventListener("tomp:native-status", handleNativeStatus);
  }, [markFresh, setSignal]);

  useEffect(() => {
    const storedConsent = window.localStorage.getItem(consentKey(driverAccess.token)) === "1";
    setCanResume(storedConsent);
    if (!storedConsent) return undefined;

    const maybeResume = async () => {
      const permissions = navigator.permissions;
      if (!permissions) return;
      const status = await permissions.query({ name: "geolocation" as PermissionName }).catch(() => null);
      if (status?.state === "granted") void startSharing();
    };

    void maybeResume();
    return undefined;
  }, [driverAccess.token, startSharing]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && window.localStorage.getItem(consentKey(driverAccess.token)) === "1") {
        void requestWakeLock();
        if (watchIdRef.current == null) void startSharing();
      }
    };
    const handleOnline = () => {
      if (window.localStorage.getItem(consentKey(driverAccess.token)) === "1" && watchIdRef.current == null) void startSharing();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      if (staleTimerRef.current != null) window.clearTimeout(staleTimerRef.current);
      void releaseWakeLock();
    };
  }, [driverAccess.token, releaseWakeLock, requestWakeLock, startSharing]);

  const isSharing = state === "sharing" || state === "requesting" || state === "stale";
  const health = evaluateLocationHealth(
    lastLocation
      ? {
          projectId: driverAccess.project.id,
          assignmentId: driverAccess.assignment.id,
          driverId: driverAccess.driver.id,
          vehicleId: driverAccess.vehicle.id,
          latitude: lastLocation.latitude,
          longitude: lastLocation.longitude,
          accuracy: lastLocation.accuracy,
          recordedAt: lastLocation.recordedAt,
          source: "driver_web_app",
          metadata: {}
        }
      : null
  );

  const statusLabel =
    state === "sharing" ? "กำลังแชร์" : state === "requesting" ? "กำลังขอสิทธิ์" : state === "stale" ? "ขาดช่วง" : state === "error" ? "ต้องตรวจสอบ" : "ยังไม่แชร์";

  const mapPoint: TrackedPoint | null = lastLocation
    ? {
        id: driverAccess.assignment.id,
        latitude: lastLocation.latitude,
        longitude: lastLocation.longitude,
        freshness: state === "sharing" ? "live" : "slow",
        title: `Call Sign ${driverAccess.callSign.callSign}`,
        subtitle: driverAccess.vehicle.plateNumber || "รถของฉัน",
        ageLabel: `ส่งเมื่อ ${formatTime(lastLocation.sentAt)}`,
        accuracy: lastLocation.accuracy
      }
    : null;

  return (
    <section className="rounded-card border border-border bg-white">
      {/* Whole card collapses — sharing keeps running while it is closed. */}
      <button
        type="button"
        onClick={() => setCardOpen((value) => !value)}
        aria-expanded={cardOpen}
        className="flex w-full items-start justify-between gap-2 p-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-ink">แชร์ตำแหน่ง GPS</span>
          <span className="block text-[12px] leading-5 text-ink-faint">{cardOpen ? message : statusLabel}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            state === "sharing" ? "bg-emerald-100 text-emerald-800" : state === "stale" ? "bg-amber-100 text-amber-800" : state === "error" ? "bg-rose-100 text-rose-700" : "bg-canvas text-ink-soft"
          }`}>
            {statusLabel}
          </span>
          <ChevronDown className={`h-4 w-4 text-ink-faint transition ${cardOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {cardOpen ? (
      <div className="grid gap-3 border-t border-border p-3.5">
      {lastLocation ? (
        <p className="text-[12px] text-ink-soft">
          ล่าสุด {formatTime(lastLocation.sentAt)} / ความแม่นยำ {lastLocation.accuracy ? Math.round(lastLocation.accuracy) : "-"} ม. / {health.message}
        </p>
      ) : null}

      <div className="rounded-card bg-blue-50 px-3 py-2 text-[12px] leading-5 text-blue-800">
        Web app ส่ง GPS ได้เมื่อหน้านี้ยังทำงานอยู่ หากต้องการต่อเนื่องตอนปิดจอหรือสลับแอป ควรใช้แอป TOMP Driver ในขั้นถัดไป
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          disabled={state === "requesting"}
          onClick={() => void startSharing()}
          className="min-h-13 rounded-command bg-route px-4 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {isSharing ? "แชร์ตำแหน่งต่อ" : canResume ? "แชร์ตำแหน่งต่อ" : "เริ่มแชร์ตำแหน่ง"}
        </button>
        {isSharing ? (
          <button
            type="button"
            onClick={() => void stopSharing()}
            className="min-h-11 rounded-command border border-border bg-white px-4 text-[13px] font-semibold text-ink-soft"
          >
            หยุดแชร์ตำแหน่ง
          </button>
        ) : null}
      </div>

      {mapPoint && lastLocation ? (
        <div className="grid gap-1.5">
          <button
            type="button"
            onClick={() => setMapOpen((value) => !value)}
            className="flex items-center justify-between rounded-card border border-border bg-canvas px-3 py-2 text-[12px] font-semibold text-ink-soft"
          >
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> ตำแหน่งของฉันบนแผนที่</span>
            <ChevronDown className={`h-4 w-4 transition ${mapOpen ? "rotate-180" : ""}`} />
          </button>
          {mapOpen ? (
            <div className="overflow-hidden rounded-card border border-border">
              <LiveTrackingMap points={[mapPoint]} height={220} />
            </div>
          ) : null}
          <a
            href={buildGoogleMapsUrl(lastLocation)}
            target="_blank"
            rel="noreferrer"
            className="text-center text-[12px] font-semibold text-route underline"
          >
            เปิดตำแหน่งของฉันใน Google Maps
          </a>
        </div>
      ) : null}
      </div>
      ) : null}
    </section>
  );
}
