"use server";

import { cookies, headers } from "next/headers";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { verifyObserverPin, OBSERVER_PIN_COOKIE_PREFIX } from "@/lib/driver-access/token";
import { getFleetTokenPinState } from "@/lib/data/fleet-view";
import { FLEET_PIN_WINDOW_MS, fleetClientFingerprint, isFleetPinRateLimited } from "@/lib/fleet-access/pin-rate-limit";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

type FleetPinCode = "fleet.pin.unlocked" | "fleet.pin.wrong" | "fleet.pin.tooMany" | "fleet.pin.required";

function clientIp(headerStore: Awaited<ReturnType<typeof headers>>) {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headerStore.get("x-real-ip") || "unknown";
}

async function recordAttempt(tokenId: string, fingerprint: string, succeeded: boolean) {
  const { client } = getSupabaseWriteClient();
  if (!client) return;
  try {
    await client.from("observer_pin_attempts").insert({ token_id: tokenId, client_fingerprint: fingerprint, succeeded }).throwOnError();
  } catch {
    // The PIN result should not fail just because the attempt log is briefly unavailable.
  }
}

async function recentFailures(tokenId: string, fingerprint: string) {
  const { client } = getSupabaseWriteClient();
  if (!client) return [];
  const since = new Date(Date.now() - FLEET_PIN_WINDOW_MS).toISOString();
  try {
    const { data } = await client
      .from("observer_pin_attempts")
      .select("attempted_at")
      .eq("token_id", tokenId)
      .eq("client_fingerprint", fingerprint)
      .eq("succeeded", false)
      .gte("attempted_at", since)
      .order("attempted_at", { ascending: false })
      .limit(20);
    return ((data ?? []) as Array<{ attempted_at: string }>).map((row) => new Date(String(row.attempted_at)).getTime()).filter(Number.isFinite);
  } catch {
    return [];
  }
}

export async function verifyFleetPinAction(input: unknown): Promise<ActionResult<{ code: FleetPinCode }>> {
  const data = input as { token?: string; pin?: string };
  const token = data.token?.trim() ?? "";
  const pin = data.pin?.trim() ?? "";
  if (!token || !pin) return actionFailure("fleet.pin.required", { code: ["fleet.pin.required"] });

  const pinState = await getFleetTokenPinState(token);
  if (!pinState) return actionFailure("fleet.pin.wrong", { code: ["fleet.pin.wrong"] });

  if (!pinState.pinHash) {
    return actionSuccess({ code: "fleet.pin.unlocked" });
  }

  const headerStore = await headers();
  const fingerprint = fleetClientFingerprint(clientIp(headerStore), headerStore.get("user-agent") ?? "");
  const failures = await recentFailures(pinState.tokenId, fingerprint);
  if (isFleetPinRateLimited(failures)) {
    return actionFailure("fleet.pin.tooMany", { code: ["fleet.pin.tooMany"] });
  }

  if (!verifyObserverPin(pin, pinState.pinHash)) {
    await recordAttempt(pinState.tokenId, fingerprint, false);
    return actionFailure("fleet.pin.wrong", { code: ["fleet.pin.wrong"] });
  }

  await recordAttempt(pinState.tokenId, fingerprint, true);
  const cookieStore = await cookies();
  cookieStore.set(`${OBSERVER_PIN_COOKIE_PREFIX}${pinState.tokenId}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/"
  });

  return actionSuccess({ code: "fleet.pin.unlocked" });
}
