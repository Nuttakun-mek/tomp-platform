import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface DriverAccessTokenDraft {
  assignmentId: string;
  driverId?: string | null;
  expiresAt?: string | null;
}

export function generateDriverAccessToken(input: DriverAccessTokenDraft): string {
  const entropy = randomBytes(32).toString("base64url");
  const driverPart = input.driverId ?? "pending";
  return `tomp_${input.assignmentId}_${driverPart}_${entropy}`;
}

export function hashDriverAccessToken(token: string): string {
  const secret = process.env.DRIVER_ACCESS_TOKEN_SECRET ?? "development-driver-token-secret";
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

