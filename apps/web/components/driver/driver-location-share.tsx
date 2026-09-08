"use client";

import { buildLocationPingPayload, evaluateLocationHealth } from "@tomp/driver-core";
import { useCallback, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { LiveTrackingMap, type TrackedPoint } from "@/components/mission-control/live-tracking-map";

type ShareState = "idle" | "requesting" | "sharing" | "error";
type TrackingEvent = "sharing_started" | "location_ping" | "sharing_stopped";

interface LastLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  sentAt: string;
}

function buildGoogleMapsUrl(location: LastLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

export function DriverLocationShare({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const [state, setState] = useState<ShareState>("idle");
  const [message, setMessage] = useState("ยังไม่ได้แชร์ตำแหน่ง");
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const lastLocationRef = useRef<LastLocation | null>(null);

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
          token: driverAccess.token,
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
      if (!response.ok || !result.success) {
        throw new Error(result.error || "ส่งตำแหน่งไม่สำเร็จ");
      }
    },
    [driverAccess]
  );

  const sendPosition = useCallback(
    async (position: GeolocationPosition, trackingEvent: TrackingEvent) => {
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
      setMessage("ส่งตำแหน่งล่าสุดให้ศูนย์ควบคุมแล้ว");
    },
    [postLocation]
  );

  function startSharing() {
    if (!("geolocation" in navigator)) {
      setState("error");
      setMessage("อุปกรณ์นี้ไม่รองรับการแชร์ตำแหน่ง");
      return;
    }
    setState("requesting");
    setMessage("กำลังขอสิทธิ์เข้าถึงตำแหน่ง กรุณากดอนุญาต");
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const event = startedRef.current ? "location_ping" : "sharing_started";
          startedRef.current = true;
          await sendPosition(position, event);
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
  }

  async function stopSharing() {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    startedRef.current = false;
    if (lastLocationRef.current) {
      await postLocation(lastLocationRef.current, "sharing_stopped").catch(() => undefined);
    }
    setState("idle");
    setMessage("หยุดแชร์ตำแหน่งแล้ว");
  }

  const isSharing = state === "sharing" || state === "requesting";
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

  const mapPoint: TrackedPoint | null = lastLocation
    ? {
        id: driverAccess.assignment.id,
        latitude: lastLocation.latitude,
        longitude: lastLocation.longitude,
        freshness: state === "sharing" ? "live" : "slow",
        title: `Call Sign ${driverAccess.callSign.callSign}`,
        subtitle: driverAccess.vehicle.plateNumber || "รถของฉัน",
        ageLabel: `ส่งเมื่อ ${lastLocation.sentAt}`,
        accuracy: lastLocation.accuracy
      }
    : null;

  return (
    <section className="grid gap-3 rounded-card border border-border bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-ink">แชร์ตำแหน่ง GPS</p>
          <p className="text-[12px] text-ink-faint">{message}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${state === "sharing" ? "bg-emerald-100 text-emerald-800" : state === "error" ? "bg-rose-100 text-rose-700" : "bg-canvas text-ink-soft"}`}>
          {state === "sharing" ? "กำลังแชร์" : state === "requesting" ? "กำลังขอสิทธิ์" : state === "error" ? "ต้องตรวจสอบ" : "ยังไม่แชร์"}
        </span>
      </div>

      {lastLocation ? (
        <p className="text-[12px] text-ink-soft">
          ล่าสุด {lastLocation.sentAt} · ความแม่นยำ {lastLocation.accuracy ? Math.round(lastLocation.accuracy) : "-"} ม. · {health.message}
        </p>
      ) : null}

      <div className="grid gap-2">
        <button
          type="button"
          disabled={isSharing}
          onClick={startSharing}
          className="min-h-13 rounded-command bg-route px-4 text-[15px] font-bold text-white disabled:opacity-50"
        >
          {isSharing ? "กำลังแชร์ตำแหน่ง…" : "เริ่มแชร์ตำแหน่ง"}
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

      {mapPoint ? (
        <div className="grid gap-1.5">
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
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
            href={buildGoogleMapsUrl(lastLocation!)}
            target="_blank"
            rel="noreferrer"
            className="text-center text-[12px] font-semibold text-route underline"
          >
            เปิดตำแหน่งของฉันใน Google Maps
          </a>
        </div>
      ) : null}
    </section>
  );
}
