import "server-only";

import { cookies } from "next/headers";
import { isSessionDeviceCurrent } from "@/lib/driver-access/device-binding";
import { markMobileSessionUsed } from "@/lib/driver-access/mobile-session";
import { DRIVER_SESSION_COOKIE, DRIVER_SESSION_HEADER, verifyDriverSession } from "@/lib/driver-access/session";

export interface DriverSessionContext {
  tokenId: string;
  projectId: string;
  assignmentId: string;
  driverId: string;
  deviceHash: string;
}

function contextFromPayload(payload: NonNullable<ReturnType<typeof verifyDriverSession>>): DriverSessionContext {
  return {
    tokenId: payload.tid,
    projectId: payload.pid,
    assignmentId: payload.aid,
    driverId: payload.did,
    deviceHash: payload.dev
  };
}

// Operational driver API routes authenticate with a scoped driver session. Web
// calls carry the HttpOnly cookie minted after PIN. Native background calls
// carry x-driver-session and must also match an active driver_mobile_sessions row.
export async function resolveDriverSession(
  request: Request
): Promise<{ ok: true; context: DriverSessionContext } | { ok: false; status: number; error: string }> {
  const fromHeader = request.headers.get(DRIVER_SESSION_HEADER)?.trim();
  const fromCookie = (await cookies()).get(DRIVER_SESSION_COOKIE)?.value;
  const sessionValue = fromHeader || fromCookie;

  const payload = verifyDriverSession(sessionValue);
  if (!payload) {
    return { ok: false, status: 401, error: "เซสชันคนขับหมดอายุ กรุณาเปิดงานจาก QR และยืนยันรหัสอีกครั้ง" };
  }

  if (fromHeader) {
    const mobileSessionStatus = await markMobileSessionUsed(fromHeader);
    if (mobileSessionStatus === "inactive") {
      return { ok: false, status: 401, error: "mobile session หมดอายุหรือถูกยกเลิก กรุณาเปิดงานจาก QR และยืนยันรหัสอีกครั้ง" };
    }
  }

  // The signature proves this session was minted for a device; it cannot prove
  // that device still holds the job. Since the PIN can move a job to a new
  // phone, the old phone's session stays cryptographically valid for its full
  // 12 hours — and would go on posting GPS and statuses for work it handed over.
  if (!(await isSessionDeviceCurrent(payload.tid, payload.dev))) {
    return { ok: false, status: 401, error: DEVICE_MOVED };
  }

  return { ok: true, context: contextFromPayload(payload) };
}

// Same, for server actions (no Request object): reads the session cookie.
export async function resolveDriverSessionFromCookies(): Promise<DriverSessionContext | null> {
  const value = (await cookies()).get(DRIVER_SESSION_COOKIE)?.value;
  const payload = verifyDriverSession(value);
  if (!payload) return null;
  if (!(await isSessionDeviceCurrent(payload.tid, payload.dev))) return null;
  return contextFromPayload(payload);
}

const DEVICE_MOVED = "งานนี้ถูกย้ายไปเปิดบนเครื่องอื่นแล้ว หากเครื่องนี้คือเครื่องที่ใช้งาน กรุณาสแกน QR และกรอกรหัสอีกครั้ง";
