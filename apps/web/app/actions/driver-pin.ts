"use server";

import { cookies } from "next/headers";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { DRIVER_PIN_COOKIE_PREFIX, hashDriverAccessToken, verifyDriverPin } from "@/lib/driver-access/token";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

const MAX_ATTEMPTS = 5;

export async function verifyDriverPinAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { token?: string; pin?: string };
  const token = String(data.token ?? "").trim();
  const pin = String(data.pin ?? "").replace(/\D/g, "");

  if (!token) return actionFailure("ไม่พบลิงก์งาน");
  if (pin.length !== 6) return actionFailure("กรอกรหัส 6 หลัก");

  const { client } = getSupabaseWriteClient();
  if (!client) return actionFailure("ระบบไม่พร้อมใช้งาน");

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

  // Tokens issued before the PIN feature have no pinHash — let them through.
  if (!pinHash) {
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
    .update({ metadata: { ...meta, pinAttempts: 0 } })
    .eq("id", row.id);
  await setPinCookie(String(row.id));
  return actionSuccess({ verified: true });
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
