"use client";

import { buildBridgeMessage, getMobileShell, NATIVE_STATUS_EVENT, parseNativeStatusDetail } from "@tomp/driver-core";

// Where a photo was taken, for the stamp on it. Never allowed to hold the photo
// up: inside the TOMP Driver app, navigator.geolocation can wait on a WebView
// permission prompt that never appears, and its own `timeout` does not start
// until permission is granted — the pre-start photos sat on "กำลังอัปโหลด…"
// forever because of it (2026-09-30). So every source has a hard deadline, and
// inside the app the app's own GPS is asked first.

export type CaptureLocation = { latitude: number; longitude: number; accuracy: number | null; recordedAt: string | null };

const FRESH_MS = 5 * 60 * 1000;
let lastNativeFix: CaptureLocation | null = null;
let listening = false;

function fromNativeDetail(detail: unknown): CaptureLocation | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const value = detail as Record<string, unknown>;
  if (typeof value.latitude !== "number" || typeof value.longitude !== "number") return null;
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    accuracy: typeof value.accuracy === "number" ? value.accuracy : null,
    recordedAt: typeof value.recordedAt === "string" ? value.recordedAt : null
  };
}

function remember(event: Event) {
  const payload = parseNativeStatusDetail((event as CustomEvent).detail);
  if (payload?.status !== "gps_sharing") return;
  const fix = fromNativeDetail(payload.detail);
  if (fix) lastNativeFix = fix;
}

function isFresh(fix: CaptureLocation | null): fix is CaptureLocation {
  if (!fix) return false;
  const at = fix.recordedAt ? Date.parse(fix.recordedAt) : Date.now();
  return Number.isFinite(at) && Date.now() - at <= FRESH_MS;
}

/** The app's latest GPS fix — the one it is already sharing — or null within `timeoutMs`. */
export function nativeLocation(timeoutMs = 1500): Promise<CaptureLocation | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const shell = getMobileShell(window);
  if (!shell) return Promise.resolve(null);
  if (!listening) {
    window.addEventListener(NATIVE_STATUS_EVENT, remember);
    listening = true;
  }
  if (isFresh(lastNativeFix)) return Promise.resolve(lastNativeFix);
  return new Promise((resolve) => {
    const done = (fix: CaptureLocation | null) => {
      window.clearTimeout(timer);
      window.removeEventListener(NATIVE_STATUS_EVENT, onStatus);
      resolve(fix);
    };
    const onStatus = (event: Event) => {
      const payload = parseNativeStatusDetail((event as CustomEvent).detail);
      const fix = payload?.status === "gps_sharing" ? fromNativeDetail(payload.detail) : null;
      if (fix) done(fix);
    };
    const timer = window.setTimeout(() => done(isFresh(lastNativeFix) ? lastNativeFix : null), timeoutMs);
    window.addEventListener(NATIVE_STATUS_EVENT, onStatus);
    shell.postMessage(buildBridgeMessage("gps.status.request", { reason: "photo_capture" }));
  });
}

/** The browser's position, or null — guaranteed to settle within `timeoutMs`. */
export function browserLocation(timeoutMs = 8000): Promise<CaptureLocation | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (fix: CaptureLocation | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(deadline);
      resolve(fix);
    };
    const deadline = window.setTimeout(() => finish(null), timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          finish({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
            recordedAt: new Date(position.timestamp).toISOString()
          }),
        () => finish(null),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: timeoutMs }
      );
    } catch {
      finish(null);
    }
  });
}

/** Best location for a photo taken now: the app's GPS inside the app, else the browser's. */
export async function photoLocation(): Promise<CaptureLocation | null> {
  const native = await nativeLocation();
  if (native) return native;
  // In the app with no fix yet the browser is a long shot; don't make the driver wait for it.
  return browserLocation(getMobileShell(typeof window === "undefined" ? undefined : window) ? 3000 : 8000);
}
