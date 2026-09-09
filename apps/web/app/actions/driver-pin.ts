"use server";

import { cookies } from "next/headers";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { resolveDriverTokenIdentity } from "@/lib/data/driver-access";
import { getPostgresClient } from "@/lib/db/postgres";
import { DRIVER_SESSION_COOKIE, DRIVER_SESSION_MAX_AGE, mintDriverSession } from "@/lib/driver-access/session";
import {
  DRIVER_DEVICE_COOKIE_PREFIX,
  DRIVER_PIN_COOKIE_PREFIX,
  generateDriverDeviceId,
  hashDriverAccessToken,
  hashDriverDeviceId,
  verifyDriverPin
} from "@/lib/driver-access/token";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

const MAX_ATTEMPTS = 5;

export async function verifyDriverPinAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { token?: string; pin?: string };
  const token = String(data.token ?? "").trim();
  const pin = String(data.pin ?? "").replace(/\D/g, "");

  if (!token) return actionFailure("ไม่พบลิงก์งาน");
  if (pin.length !== 6) return actionFailure("กรอกรหัส 6 หลัก");

  const { client } = getSupabaseWriteClient();
  if (!client) return verifyDriverPinViaPostgres(token, pin);

  const { data: row } = await client
    .from("driver_access_tokens")
    .select("id, status, expires_at, metadata")
    .eq("token_hash", hashDriverAccessToken(token))
    .maybeSingle();

  if (!row) return actionFailure("ไม่พบงานสำหรับลิงก์นี้");
  if (row.status !== "active") return actionFailure("ลิงก์นี้ถูกยกเลิกแล้ว");
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return actionFailure("ลิงก์นี้หมดอายุแล้ว");

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const pinHash = typeof meta.pinHash === "string" ? meta.pinHash : "";
  const attempts = typeof meta.pinAttempts === "number" ? meta.pinAttempts : 0;
  const boundDevice = typeof meta.deviceHash === "string" ? meta.deviceHash : "";
  const deviceId = await resolveDeviceId();
  const deviceHash = hashDriverDeviceId(deviceId);

  if (boundDevice && boundDevice !== deviceHash) return actionFailure(DEVICE_TAKEN);

  // Tokens issued before the PIN feature have no pinHash — let them through.
  if (!pinHash) {
    await client.from("driver_access_tokens").update({ metadata: { ...meta, deviceHash } }).eq("id", row.id);
    await setPinCookie(String(row.id));
    return actionSuccess({ verified: true });
  }

  if (attempts >= MAX_ATTEMPTS) {
    await client.from("driver_access_tokens").update({ status: "revoked" }).eq("id", row.id);
    return actionFailure("กรอกรหัสผิดเกินกำหนด ลิงก์ถูกล็อก กรุณาขอลิงก์ใหม่จากศูนย์ควบคุม");
  }

  if (!verifyDriverPin(pin, pinHash)) {
    await client
      .from("driver_access_tokens")
      .update({ metadata: { ...meta, pinAttempts: attempts + 1 } })
      .eq("id", row.id);
    return actionFailure(`รหัสไม่ถูกต้อง (เหลือ ${MAX_ATTEMPTS - attempts - 1} ครั้ง)`);
  }

  await client
    .from("driver_access_tokens")
    .update({ metadata: { ...meta, pinAttempts: 0, deviceHash } })
    .eq("id", row.id);
  await setPinCookie(String(row.id));
  return actionSuccess({ verified: true });
}

// Exchange a QR token (that has already cleared the visible device + PIN flow)
// for a scoped driver session cookie. The operational /api/driver/* routes only
// accept this session — never the raw token — so a leaked QR URL can't drive
// the API. Called once when the task/preflight view mounts.
export async function establishDriverSessionAction(input: unknown): Promise<ActionResult> {
  const token = String((input as { token?: unknown })?.token ?? "").trim();
  if (!token.startsWith("tomp_")) return actionFailure("ไม่พบลิงก์งาน");

  const identity = await resolveDriverTokenIdentity(token);
  if (!identity) return actionFailure("QR หมดอายุหรือถูกยกเลิก");

  const store = await cookies();
  const deviceId = store.get(DRIVER_DEVICE_COOKIE_PREFIX + "id")?.value ?? "";
  const deviceHash = deviceId ? hashDriverDeviceId(deviceId) : "";

  if (identity.deviceBoundTo && identity.deviceBoundTo !== deviceHash) {
    return actionFailure(DEVICE_TAKEN);
  }

  if (identity.pinRequired) {
    const pinOk = store.get(`${DRIVER_PIN_COOKIE_PREFIX}${identity.tokenId}`)?.value === "1";
    if (!pinOk) return actionFailure("ต้องยืนยันรหัสก่อนเปิดงาน", { needsPin: ["1"] });
  }

  store.set(DRIVER_SESSION_COOKIE, mintDriverSession({
    tid: identity.tokenId,
    pid: identity.projectId,
    aid: identity.assignmentId,
    did: identity.driverId,
    dev: deviceHash
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DRIVER_SESSION_MAX_AGE
  });

  return actionSuccess({ established: true });
}

async function verifyDriverPinViaPostgres(token: string, pin: string): Promise<ActionResult> {
  const sql = getPostgresClient();
  if (!sql) return actionFailure("ระบบยังไม่พร้อมใช้งาน กรุณาตรวจการเชื่อมต่อฐานข้อมูล");

  const rows = await sql<Array<{ id: string; status: string; expires_at: string | null; metadata: Record<string, unknown> | null }>>`
    select id, status, expires_at, metadata
    from driver_access_tokens
    where token_hash = ${hashDriverAccessToken(token)}
    limit 1
  `;
  const row = rows[0];

  if (!row) return actionFailure("ไม่พบงานสำหรับลิงก์นี้");
  if (row.status !== "active") return actionFailure("ลิงก์นี้ถูกยกเลิกแล้ว");
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return actionFailure("ลิงก์นี้หมดอายุแล้ว");

  const meta = row.metadata ?? {};
  const pinHash = typeof meta.pinHash === "string" ? meta.pinHash : "";
  const attempts = typeof meta.pinAttempts === "number" ? meta.pinAttempts : 0;
  const boundDevice = typeof meta.deviceHash === "string" ? meta.deviceHash : "";
  const deviceId = await resolveDeviceId();
  const deviceHash = hashDriverDeviceId(deviceId);

  if (boundDevice && boundDevice !== deviceHash) return actionFailure(DEVICE_TAKEN);

  if (!pinHash) {
    const boundMeta = JSON.stringify({ ...meta, deviceHash });
    await sql`update driver_access_tokens set metadata = ${boundMeta}::jsonb where id = ${row.id}`;
    await setPinCookie(row.id);
    return actionSuccess({ verified: true });
  }

  if (attempts >= MAX_ATTEMPTS) {
    await sql`update driver_access_tokens set status = 'revoked' where id = ${row.id}`;
    return actionFailure("กรอกรหัสผิดเกินกำหนด ลิงก์ถูกล็อก กรุณาขอลิงก์ใหม่จากศูนย์ควบคุม");
  }

  if (!verifyDriverPin(pin, pinHash)) {
    const updatedMeta = JSON.stringify({ ...meta, pinAttempts: attempts + 1 });
    await sql`update driver_access_tokens set metadata = ${updatedMeta}::jsonb where id = ${row.id}`;
    return actionFailure(`รหัสไม่ถูกต้อง (เหลือ ${MAX_ATTEMPTS - attempts - 1} ครั้ง)`);
  }

  const resetMeta = JSON.stringify({ ...meta, pinAttempts: 0, deviceHash });
  await sql`update driver_access_tokens set metadata = ${resetMeta}::jsonb where id = ${row.id}`;
  await setPinCookie(row.id);
  return actionSuccess({ verified: true });
}

const DEVICE_TAKEN = "งานนี้ถูกเปิดใช้บนอุปกรณ์อื่นแล้ว หากต้องการย้ายเครื่อง กรุณาให้ศูนย์ควบคุมออก QR ใหม่";

// Returns the caller's device id, creating one if this phone has never claimed a
// job before. The raw id stays in an httpOnly cookie; only the hash is stored.
async function resolveDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DRIVER_DEVICE_COOKIE_PREFIX + "id")?.value;
  if (existing) return existing;
  const fresh = generateDriverDeviceId();
  store.set(DRIVER_DEVICE_COOKIE_PREFIX + "id", fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  });
  return fresh;
}

async function setPinCookie(tokenId: string) {
  const store = await cookies();
  store.set(`${DRIVER_PIN_COOKIE_PREFIX}${tokenId}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/driver",
    maxAge: 60 * 60 * 12
  });
}
