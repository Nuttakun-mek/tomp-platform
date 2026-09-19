"use server";

import { cookies } from "next/headers";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { pinFailurePatch, pinLockedMessage, pinWrongMessage, readPinLock } from "@/lib/domain/driver-pin-lock";
import { HELPER_PIN_COOKIE_PREFIX, findProjectHelperToken, updateProjectHelperTokenMetadata, verifyProjectHelperPin } from "@/lib/project-helper/tokens";

// Same cookie-per-token pattern as apps/web/app/actions/driver-pin.ts's
// verifyDriverPinAction: the PIN cookie is scoped to the token's own id (not
// the raw token, which never touches a cookie), httpOnly, and path-scoped to
// /helper so it only ever rides along on requests for this claim flow.
//
// Rate limiting reuses lib/domain/driver-pin-lock.ts as-is: that module's
// arithmetic (attempt counting, lockout window) reads/writes a plain
// metadata blob and was never actually driver-specific, only its Thai copy
// is. project_helper_tokens.metadata is jsonb, same as
// driver_access_tokens.metadata, so the same pinAttempts/pinLockedUntil
// fields live alongside pinHash the same way.

export async function verifyProjectHelperPinAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { token?: string; pin?: string };
  const token = String(data.token ?? "").trim();
  const pin = String(data.pin ?? "").replace(/\D/g, "");

  if (!token) return actionFailure("ไม่พบลิงก์นี้");
  if (!pin.length) return actionFailure("กรอกรหัส PIN");

  const claim = await findProjectHelperToken(token);
  if (!claim) return actionFailure("ไม่พบลิงก์นี้ หรือลิงก์ถูกยกเลิกแล้ว");

  const lock = readPinLock(claim.metadata);
  if (lock.locked) return actionFailure(pinLockedMessage(lock.retryAfterSeconds));

  if (!verifyProjectHelperPin(claim, pin)) {
    const failure = pinFailurePatch(lock);
    await updateProjectHelperTokenMetadata(claim.tokenId, { ...claim.metadata, pinAttempts: failure.pinAttempts, pinLockedUntil: failure.pinLockedUntil });
    return failure.remaining === 0
      ? actionFailure(pinLockedMessage(Math.ceil((new Date(String(failure.pinLockedUntil)).getTime() - Date.now()) / 1000)))
      : actionFailure(pinWrongMessage(failure.remaining));
  }

  // Correct PIN clears any attempts recorded earlier in this window.
  if (lock.attempts > 0) {
    await updateProjectHelperTokenMetadata(claim.tokenId, { ...claim.metadata, pinAttempts: 0, pinLockedUntil: null });
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
