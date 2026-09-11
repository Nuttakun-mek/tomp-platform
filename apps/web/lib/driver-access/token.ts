import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readCleanEnv } from "@/lib/env";

// Every QR token, PIN and device binding is hashed with this. It is read through
// readCleanEnv so it resolves the same way as the rest of the config (process.env
// first, then .env.local at the app root or the repo root) — reading
// process.env directly meant a monorepo dev server silently hashed everything
// with the public fallback below while a real secret sat in .env.local.
//
// In production a missing secret is a misconfiguration, not something to paper
// over: falling back would hash real driver credentials with a constant that is
// published in this repository, so fail loudly instead.
const DEV_FALLBACK_SECRET = "development-driver-token-secret";

export function driverTokenSecret(): string {
  const secret = readCleanEnv("DRIVER_ACCESS_TOKEN_SECRET");
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DRIVER_ACCESS_TOKEN_SECRET is not configured. Refusing to hash driver QR tokens, PINs or device bindings with the public development fallback."
    );
  }
  return DEV_FALLBACK_SECRET;
}

export interface DriverAccessTokenDraft {
  assignmentId?: string | null;
  callSignId?: string | null;
  driverId?: string | null;
  expiresAt?: string | null;
}

export function generateDriverAccessToken(input: DriverAccessTokenDraft): string {
  const entropy = randomBytes(32).toString("base64url");
  const driverPart = input.driverId ?? "pending";
  const scopePart = input.callSignId ?? input.assignmentId ?? "unscoped";
  return `tomp_${scopePart}_${driverPart}_${entropy}`;
}

export function hashDriverAccessToken(token: string): string {
  const secret = driverTokenSecret();
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export function verifyDriverAccessTokenHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashDriverAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function getDefaultDriverTokenExpiry(hours = 24): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// Second factor: a 6-digit PIN the control centre reads to the driver separately
// from the QR link. Stored only as a hash on the token row.
export function generateDriverPin(): string {
  return String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}

export function hashDriverPin(pin: string): string {
  const secret = driverTokenSecret();
  return createHash("sha256").update(`pin:${secret}:${pin.trim()}`).digest("hex");
}

export const DRIVER_PIN_COOKIE_PREFIX = "dpin_";

export function verifyDriverPin(pin: string, expectedHash: string): boolean {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashDriverPin(pin), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export const OBSERVER_PIN_COOKIE_PREFIX = "opin_";

export function generateObserverPin(): string {
  return generateDriverPin();
}

export function hashObserverPin(pin: string): string {
  const secret = driverTokenSecret();
  return createHash("sha256").update(`observer-pin:${secret}:${pin.trim()}`).digest("hex");
}

export function verifyObserverPin(pin: string, expectedHash: string): boolean {
  if (!pin.trim() || !expectedHash) return false;
  const actual = Buffer.from(hashObserverPin(pin), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}


// Device binding: one QR + PIN opens the job on exactly one device. The raw
// device id lives in a cookie on that phone; only its hash is stored on the token
// row, so the centre can tell "already claimed" without tracking the device.
export const DRIVER_DEVICE_COOKIE_PREFIX = "ddev_";

export function generateDriverDeviceId(): string {
  return randomBytes(24).toString("base64url");
}

export function hashDriverDeviceId(deviceId: string): string {
  const secret = driverTokenSecret();
  return createHash("sha256").update(`device:${secret}:${deviceId.trim()}`).digest("hex");
}

export interface ObserverAccessTokenDraft {
  projectId?: string | null;
  callSignId?: string | null;
  scope?: "call_sign" | "project";
  expiresAt?: string | null;
}

export function generateObserverAccessToken(input: ObserverAccessTokenDraft): string {
  const scope = input.scope ?? (input.callSignId ? "call_sign" : "project");
  const scopePart = scope === "project" ? input.projectId ?? "project" : input.callSignId ?? "call-sign";
  return `tomp_obs_${scope}_${scopePart}_${randomBytes(32).toString("base64url")}`;
}

export function hashObserverAccessToken(token: string): string {
  const secret = driverTokenSecret();
  return createHash("sha256").update(`observer:${secret}:${token}`).digest("hex");
}

export function verifyObserverAccessTokenHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashObserverAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
