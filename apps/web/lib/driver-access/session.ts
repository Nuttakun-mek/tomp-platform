import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// A driver session is the credential the driver's operational API calls carry —
// NOT the raw QR token. It is minted only after the visible page flow has
// cleared device binding and (when required) the PIN, then bound to the exact
// token/assignment/driver/device so a leaked QR URL can no longer drive the API.

export const DRIVER_SESSION_COOKIE = "dsess";
export const DRIVER_SESSION_HEADER = "x-driver-session";
const TTL_SECONDS = 12 * 60 * 60;

export interface DriverSessionPayload {
  /** driver_access_tokens.id */
  tid: string;
  /** project id */
  pid: string;
  /** assignment id */
  aid: string;
  /** driver id */
  did: string;
  /** sha256 of the claiming device */
  dev: string;
  /** unix seconds */
  exp: number;
}

function secret(): string {
  return process.env.DRIVER_ACCESS_TOKEN_SECRET ?? "development-driver-token-secret";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(`dsess:${body}`).digest("base64url");
}

export function mintDriverSession(payload: Omit<DriverSessionPayload, "exp">): string {
  const full: DriverSessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyDriverSession(value: string | null | undefined): DriverSessionPayload | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const providedSig = value.slice(dot + 1);

  const expectedSig = sign(body);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: DriverSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DriverSessionPayload;
  } catch {
    return null;
  }

  if (!payload.tid || !payload.aid || !payload.pid || !payload.did) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

export const DRIVER_SESSION_MAX_AGE = TTL_SECONDS;
