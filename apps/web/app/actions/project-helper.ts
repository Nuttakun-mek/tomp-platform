"use server";

import { cookies } from "next/headers";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { HELPER_PIN_COOKIE_PREFIX, findProjectHelperToken, verifyProjectHelperPin } from "@/lib/project-helper/tokens";

// Same cookie-per-token pattern as apps/web/app/actions/driver-pin.ts's
// verifyDriverPinAction: the PIN cookie is scoped to the token's own id (not
// the raw token, which never touches a cookie), httpOnly, and path-scoped to
// /helper so it only ever rides along on requests for this claim flow.

export async function verifyProjectHelperPinAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { token?: string; pin?: string };
  const token = String(data.token ?? "").trim();
  const pin = String(data.pin ?? "").replace(/\D/g, "");

  if (!token) return actionFailure("ไม่พบลิงก์นี้");
  if (!pin.length) return actionFailure("กรอกรหัส PIN");

  const claim = await findProjectHelperToken(token);
  if (!claim) return actionFailure("ไม่พบลิงก์นี้ หรือลิงก์ถูกยกเลิกแล้ว");

  if (!verifyProjectHelperPin(claim, pin)) {
    return actionFailure("รหัส PIN ไม่ถูกต้อง");
  }

  const store = await cookies();
  store.set(`${HELPER_PIN_COOKIE_PREFIX}${claim.tokenId}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/helper",
    maxAge: 60 * 60 * 24 * 30
  });

  return actionSuccess({ verified: true });
}
