import { createHash } from "node:crypto";

export const FLEET_PIN_MAX_FAILURES = 10;
export const FLEET_PIN_WINDOW_MS = 15 * 60 * 1000;

export function isFleetPinRateLimited(recentFailureTimes: number[], now = Date.now()): boolean {
  const recent = recentFailureTimes.filter((attemptedAt) => Number.isFinite(attemptedAt) && attemptedAt <= now && now - attemptedAt < FLEET_PIN_WINDOW_MS);
  return recent.length >= FLEET_PIN_MAX_FAILURES;
}

export function fleetClientFingerprint(ip: string, userAgent: string): string {
  return createHash("sha256").update(`${ip.trim()}::${userAgent.trim()}`).digest("hex");
}
