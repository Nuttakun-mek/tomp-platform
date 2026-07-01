import type { DriverLocationHealth, DriverLocationPing, DriverLocationSession } from "@tomp/types/domain";

function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented. Use apps/web server actions until the shared API is wired.`);
}

export async function startDriverLocationSession(_input: DriverLocationSession): Promise<DriverLocationSession> {
  return notImplemented("startDriverLocationSession");
}

export async function submitDriverLocationPing(_input: DriverLocationPing): Promise<void> {
  return notImplemented("submitDriverLocationPing");
}

export async function stopDriverLocationSession(_sessionId: string): Promise<void> {
  return notImplemented("stopDriverLocationSession");
}

export async function getDriverLocationHealth(_sessionId: string): Promise<DriverLocationHealth> {
  return notImplemented("getDriverLocationHealth");
}
