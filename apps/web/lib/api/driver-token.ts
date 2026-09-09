import "server-only";

import { cookies } from "next/headers";
import { DRIVER_SESSION_COOKIE, DRIVER_SESSION_HEADER, verifyDriverSession } from "@/lib/driver-access/session";

export interface DriverSessionContext {
  tokenId: string;
  projectId: string;
  assignmentId: string;
  driverId: string;
  deviceHash: string;
}

// Operational driver API routes authenticate with the scoped driver SESSION —
// minted only after the visible device + PIN flow (see establishDriverSessionAction).
// The raw QR token is no longer accepted here: possession of the QR URL alone
// cannot read or write driver operations.
export async function resolveDriverSession(
  request: Request
): Promise<{ ok: true; context: DriverSessionContext } | { ok: false; status: number; error: string }> {
  const fromHeader = request.headers.get(DRIVER_SESSION_HEADER)?.trim();
  const fromCookie = (await cookies()).get(DRIVER_SESSION_COOKIE)?.value;

  const payload = verifyDriverSession(fromHeader || fromCookie);
  if (!payload) {
    return { ok: false, status: 401, error: "เซสชันคนขับหมดอายุ กรุณาเปิดงานจาก QR และยืนยันรหัสอีกครั้ง" };
  }

  return {
    ok: true,
    context: {
      tokenId: payload.tid,
      projectId: payload.pid,
      assignmentId: payload.aid,
      driverId: payload.did,
      deviceHash: payload.dev
    }
  };
}

// Same, for server actions (no Request object) — reads the session cookie.
export async function resolveDriverSessionFromCookies(): Promise<DriverSessionContext | null> {
  const value = (await cookies()).get(DRIVER_SESSION_COOKIE)?.value;
  const payload = verifyDriverSession(value);
  if (!payload) return null;
  return {
    tokenId: payload.tid,
    projectId: payload.pid,
    assignmentId: payload.aid,
    driverId: payload.did,
    deviceHash: payload.dev
  };
}
