"use server";

import { cookies } from "next/headers";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { resolveDriverTokenIdentity } from "@/lib/data/driver-access";
import { releaseDeviceFromOtherUnits, revokeMobileSessionsForOtherDevices } from "@/lib/driver-access/device-binding";
import { getPostgresClient } from "@/lib/db/postgres";
import {
  deviceBindPatch,
  pinFailurePatch,
  pinLockedMessage,
  pinWrongMessage,
  readPinLock
} from "@/lib/domain/driver-pin-lock";
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

// Order matters here: the PIN is checked BEFORE the device binding, so a driver
// whose phone lost its cookie (reinstall, cleared data, new handset) can prove
// who they are and take the job back on the same QR. Checking the device first
// — as this did originally — meant the only fix was issuing a new QR, which
// splits the driver into a second Mission Control card and orphans the job
// history. The QR alone is still not enough: without the PIN nothing moves, and
// wrong PINs cool the link down instead of killing it (see driver-pin-lock).

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
    .select("id, project_id, status, expires_at, metadata")
    .eq("token_hash", hashDriverAccessToken(token))
    .maybeSingle();

  if (!row) return actionFailure("ไม่พบงานสำหรับลิงก์นี้");
  if (row.status !== "active") return actionFailure("ลิงก์นี้ถูกยกเลิกแล้ว");
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return actionFailure("ลิงก์นี้หมดอายุแล้ว");

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const pinHash = typeof meta.pinHash === "string" ? meta.pinHash : "";
  const boundDevice = typeof meta.deviceHash === "string" ? meta.deviceHash : "";
  const deviceId = await resolveDeviceId();
  const deviceHash = hashDriverDeviceId(deviceId);

  // Tokens issued before the PIN feature have no second factor, so the device
  // binding is all they have — keep it strict for them.
  if (!pinHash) {
    if (boundDevice && boundDevice !== deviceHash) return actionFailure(DEVICE_TAKEN_NO_PIN);
    await client.from("driver_access_tokens").update({ metadata: { ...meta, deviceHash } }).eq("id", row.id);
    await setPinCookie(String(row.id));
    return actionSuccess({ verified: true });
  }

  const lock = readPinLock(meta);
  if (lock.locked) return actionFailure(pinLockedMessage(lock.retryAfterSeconds));

  if (!verifyDriverPin(pin, pinHash)) {
    const failure = pinFailurePatch(lock);
    await client
      .from("driver_access_tokens")
      .update({ metadata: { ...meta, pinAttempts: failure.pinAttempts, pinLockedUntil: failure.pinLockedUntil } })
      .eq("id", row.id);
    return failure.remaining === 0
      ? actionFailure(pinLockedMessage(Math.ceil((new Date(String(failure.pinLockedUntil)).getTime() - Date.now()) / 1000)))
      : actionFailure(pinWrongMessage(failure.remaining));
  }

  const bind = deviceBindPatch(boundDevice, deviceHash, meta.deviceRebindings);
  await client
    .from("driver_access_tokens")
    .update({
      metadata: {
        ...meta,
        pinAttempts: 0,
        pinLockedUntil: null,
        deviceHash: bind.deviceHash,
        deviceRebindings: bind.deviceRebindings
      }
    })
    .eq("id", row.id);
  // The phone that just lost the job keeps a signed session that stays valid
  // for hours. Cut its native session off here; resolveDriverSession turns away
  // the cookie.
  if (bind.rebound) await revokeMobileSessionsForOtherDevices(String(row.id), deviceHash);
  // One phone, one unit: claiming this one lets go of any other it was holding.
  await dropPinCookies(await releaseDeviceFromOtherUnits(String(row.project_id ?? ""), String(row.id), deviceHash));
  await setPinCookie(String(row.id));
  return actionSuccess({ verified: true, rebound: bind.rebound });
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
  const pinOk = store.get(`${DRIVER_PIN_COOKIE_PREFIX}${identity.tokenId}`)?.value === "1";

  // A device mismatch is no longer fatal on its own: verifyDriverPinAction has
  // already re-bound the token to this phone before setting the PIN cookie, so
  // the mismatch we can still see here is a stale identity read. Without a PIN
  // on the token, the binding remains the only factor and stays strict.
  if (identity.deviceBoundTo && identity.deviceBoundTo !== deviceHash && !(identity.pinRequired && pinOk)) {
    return actionFailure(identity.pinRequired ? DEVICE_TAKEN_NEEDS_PIN : DEVICE_TAKEN_NO_PIN, { needsPin: identity.pinRequired ? ["1"] : [] });
  }

  if (identity.pinRequired && !pinOk) {
    return actionFailure("ต้องยืนยันรหัสก่อนเปิดงาน", { needsPin: ["1"] });
  }

  store.set(DRIVER_SESSION_COOKIE, mintDriverSession({
    tid: identity.tokenId,
    pid: identity.projectId,
    aid: identity.assignmentId || null,
    csid: identity.callSignId || null,
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

  const rows = await sql<Array<{ id: string; project_id: string; status: string; expires_at: string | null; metadata: Record<string, unknown> | null }>>`
    select id, project_id, status, expires_at, metadata
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
  const boundDevice = typeof meta.deviceHash === "string" ? meta.deviceHash : "";
  const deviceId = await resolveDeviceId();
  const deviceHash = hashDriverDeviceId(deviceId);

  if (!pinHash) {
    if (boundDevice && boundDevice !== deviceHash) return actionFailure(DEVICE_TAKEN_NO_PIN);
    const boundMeta = JSON.stringify({ ...meta, deviceHash });
    await sql`update driver_access_tokens set metadata = ${boundMeta}::jsonb where id = ${row.id}`;
    await setPinCookie(row.id);
    return actionSuccess({ verified: true });
  }

  const lock = readPinLock(meta);
  if (lock.locked) return actionFailure(pinLockedMessage(lock.retryAfterSeconds));

  if (!verifyDriverPin(pin, pinHash)) {
    const failure = pinFailurePatch(lock);
    const updatedMeta = JSON.stringify({ ...meta, pinAttempts: failure.pinAttempts, pinLockedUntil: failure.pinLockedUntil });
    await sql`update driver_access_tokens set metadata = ${updatedMeta}::jsonb where id = ${row.id}`;
    return failure.remaining === 0
      ? actionFailure(pinLockedMessage(Math.ceil((new Date(String(failure.pinLockedUntil)).getTime() - Date.now()) / 1000)))
      : actionFailure(pinWrongMessage(failure.remaining));
  }

  const bind = deviceBindPatch(boundDevice, deviceHash, meta.deviceRebindings);
  const resetMeta = JSON.stringify({
    ...meta,
    pinAttempts: 0,
    pinLockedUntil: null,
    deviceHash: bind.deviceHash,
    deviceRebindings: bind.deviceRebindings
  });
  await sql`update driver_access_tokens set metadata = ${resetMeta}::jsonb where id = ${row.id}`;
  if (bind.rebound) await revokeMobileSessionsForOtherDevices(row.id, deviceHash);
  await dropPinCookies(await releaseDeviceFromOtherUnits(String(row.project_id ?? ""), row.id, deviceHash));
  await setPinCookie(row.id);
  return actionSuccess({ verified: true, rebound: bind.rebound });
}

/** The token has no PIN, so there is no way to prove a device change is legitimate. */
const DEVICE_TAKEN_NO_PIN = "งานนี้ถูกเปิดใช้บนอุปกรณ์อื่นแล้ว หากต้องการย้ายเครื่อง กรุณาให้ศูนย์ควบคุมออก QR ใหม่";
/** The token has a PIN, so the driver can move the job here by entering it. */
const DEVICE_TAKEN_NEEDS_PIN = "งานนี้เปิดอยู่บนเครื่องอื่น กรอกรหัส 6 หลักเพื่อย้ายมาที่เครื่องนี้";

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

/**
 * Forget the PIN for units this device just let go of.
 *
 * Without this the released unit's page still finds a PIN cookie and renders the
 * job, even though the device no longer holds it — a screen that looks live and
 * cannot act. Dropping it sends that page to the takeover gate, which is the
 * truth.
 */
async function dropPinCookies(tokenIds: string[]) {
  if (!tokenIds.length) return;
  const store = await cookies();
  for (const tokenId of tokenIds) {
    store.set(`${DRIVER_PIN_COOKIE_PREFIX}${tokenId}`, "", { path: "/driver", maxAge: 0 });
  }
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
