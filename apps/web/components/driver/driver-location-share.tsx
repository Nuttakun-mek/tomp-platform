"use client";

import { useEffect, useRef, useState } from "react";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

type ShareState = "idle" | "requesting" | "sharing" | "error";

interface LastLocation {
  accuracy: number | null;
  sentAt: string;
}

export function DriverLocationShare({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const [state, setState] = useState<ShareState>("idle");
  const [message, setMessage] = useState("ยังไม่ได้แชร์ตำแหน่ง");
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  async function sendLocation(position: GeolocationPosition, trackingEvent: "sharing_started" | "location_ping" | "sharing_stopped") {
    const payload = {
      token: driverAccess.token,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
      recordedAt: new Date(position.timestamp).toISOString(),
      trackingEvent,
      metadata: {
        assignmentId: driverAccess.assignment.id,
        callSign: driverAccess.callSign.callSign,
        driverName: driverAccess.driver.fullName
      }
    };

    const response = await fetch("/api/driver/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      throw new Error(result.error || "ส่งตำแหน่งไม่สำเร็จ");
    }

    setLastLocation({
      accuracy: position.coords.accuracy ?? null,
      sentAt: new Date().toLocaleTimeString("th-TH")
    });
    setMessage("ส่งตำแหน่งล่าสุดแล้ว");
  }

  function startSharing() {
    if (!("geolocation" in navigator)) {
      setState("error");
      setMessage("เครื่องนี้ไม่รองรับการแชร์ตำแหน่ง");
      return;
    }

    setState("requesting");
    setMessage("กำลังขอสิทธิ์เข้าถึงตำแหน่งจาก browser");

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const event = startedRef.current ? "location_ping" : "sharing_started";
          startedRef.current = true;
          setState("sharing");
          await sendLocation(position, event);
        } catch (error) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "ส่งตำแหน่งไม่สำเร็จ");
        }
      },
      (error) => {
        setState("error");
        setMessage(error.message || "ไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  }

  async function stopSharing() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    startedRef.current = false;
    setState("idle");
    setMessage("หยุดแชร์ตำแหน่งแล้ว");
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const isSharing = state === "sharing" || state === "requesting";

  return (
    <section className="rounded-md border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-900">แชร์ตำแหน่ง GPS</p>
          <h3 className="mt-1 text-xl font-semibold text-blue-950">ให้ศูนย์ควบคุมเห็นตำแหน่งรถ</h3>
          <p className="mt-2 text-sm leading-6 text-blue-900">
            เปิดเฉพาะระหว่างปฏิบัติงาน ระบบจะส่งตำแหน่งล่าสุดจาก web app นี้ไปยัง Mission Control
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">
          {state === "sharing" ? "กำลังแชร์" : state === "requesting" ? "กำลังขอสิทธิ์" : state === "error" ? "ต้องตรวจสอบ" : "ยังไม่แชร์"}
        </span>
      </div>

      <div className="mt-4 rounded-md bg-white p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">{message}</p>
        {lastLocation ? (
          <p className="mt-2">
            ล่าสุด {lastLocation.sentAt} | accuracy {lastLocation.accuracy ? Math.round(lastLocation.accuracy) : "-"} เมตร
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          onClick={stopSharing}
        >
          หยุดแชร์ตำแหน่ง
        </button>
      </div>
    </section>
  );
}
