import type { DriverLocationHealth, DriverLocationPing } from "@tomp/types/domain";

export function detectStaleLocation(recordedAt: string, staleAfterSeconds = 120) {
  const recorded = new Date(recordedAt).getTime();
  if (Number.isNaN(recorded)) return true;
  return Date.now() - recorded > staleAfterSeconds * 1000;
}

export function evaluateLocationHealth(ping?: DriverLocationPing | null): DriverLocationHealth {
  if (!ping) return { status: "offline", message: "ยังไม่มีสัญญาณ GPS", stale: true };
  const stale = detectStaleLocation(ping.recordedAt);
  if (stale) return { status: "stale", message: "สัญญาณ GPS ไม่อัปเดต", stale: true, lastPingAt: ping.recordedAt };
  if (typeof ping.accuracy === "number" && ping.accuracy > 100) {
    return { status: "weak", message: "ความแม่นยำ GPS ต่ำ", stale: false, lastPingAt: ping.recordedAt };
  }
  return { status: "healthy", message: "GPS ทำงานปกติ", stale: false, lastPingAt: ping.recordedAt };
}

export function buildLocationPingPayload(input: DriverLocationPing): DriverLocationPing {
  return { ...input, recordedAt: input.recordedAt || new Date().toISOString() };
}

export function getLocationWarningMessage(health: DriverLocationHealth) {
  return health.status === "healthy" ? null : health.message;
}
