import { afterEach, describe, expect, it, vi } from "vitest";
import { driverTokenSecret, generateDriverAccessToken, hashDriverAccessToken, verifyDriverAccessTokenHash } from "../token";

describe("driver access tokens", () => {
  it("generates and verifies hashed driver tokens", () => {
    const token = generateDriverAccessToken({ assignmentId: "assignment-1", driverId: "driver-1" });
    const hash = hashDriverAccessToken(token);

    expect(token).toContain("tomp_assignment-1_driver-1_");
    expect(hash).toHaveLength(64);
    expect(verifyDriverAccessTokenHash(token, hash)).toBe(true);
  });
});

describe("driver token secret resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured secret when one is set", () => {
    vi.stubEnv("DRIVER_ACCESS_TOKEN_SECRET", "a-real-secret");
    expect(driverTokenSecret()).toBe("a-real-secret");
  });

  it("refuses the public fallback in production", () => {
    vi.stubEnv("DRIVER_ACCESS_TOKEN_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => driverTokenSecret()).toThrow(/DRIVER_ACCESS_TOKEN_SECRET is not configured/);
  });

  it("changing the secret invalidates previously issued token hashes", () => {
    vi.stubEnv("DRIVER_ACCESS_TOKEN_SECRET", "secret-one");
    const token = generateDriverAccessToken({ assignmentId: "a", driverId: "d" });
    const hash = hashDriverAccessToken(token);

    vi.stubEnv("DRIVER_ACCESS_TOKEN_SECRET", "secret-two");
    expect(verifyDriverAccessTokenHash(token, hash)).toBe(false);
  });
});
