import { afterEach, describe, expect, it, vi } from "vitest";
import {
  driverTokenSecret,
  generateDriverAccessToken,
  generateObserverPin,
  generateObserverAccessToken,
  hashDriverAccessToken,
  hashObserverPin,
  hashObserverAccessToken,
  verifyDriverAccessTokenHash,
  verifyObserverPin,
  verifyObserverAccessTokenHash
} from "../token";

describe("driver access tokens", () => {
  it("generates and verifies hashed driver tokens", () => {
    const token = generateDriverAccessToken({ assignmentId: "assignment-1", driverId: "driver-1" });
    const hash = hashDriverAccessToken(token);

    expect(token).toContain("tomp_assignment-1_driver-1_");
    expect(hash).toHaveLength(64);
    expect(verifyDriverAccessTokenHash(token, hash)).toBe(true);
  });

  it("generates call sign-scoped driver tokens", () => {
    const token = generateDriverAccessToken({ callSignId: "call-sign-1", driverId: "driver-1" });
    expect(token).toContain("tomp_call-sign-1_driver-1_");
  });

  it("keeps observer token hashes separate from driver token hashes", () => {
    const token = generateObserverAccessToken({ callSignId: "call-sign-1" });
    const observerHash = hashObserverAccessToken(token);
    const driverHash = hashDriverAccessToken(token);

    expect(token).toContain("tomp_obs_call_sign_call-sign-1_");
    expect(observerHash).toHaveLength(64);
    expect(observerHash).not.toBe(driverHash);
    expect(verifyObserverAccessTokenHash(token, observerHash)).toBe(true);
    expect(verifyDriverAccessTokenHash(token, observerHash)).toBe(false);
  });

  it("generates project-scoped observer tokens", () => {
    const token = generateObserverAccessToken({ scope: "project", projectId: "project-1" });
    expect(token).toContain("tomp_obs_project_project-1_");
  });

  it("generates and verifies observer PINs separately from driver PINs", () => {
    const pin = generateObserverPin();
    const hash = hashObserverPin(pin);

    expect(pin).toMatch(/^\d{6}$/);
    expect(hash).toHaveLength(64);
    expect(verifyObserverPin(pin, hash)).toBe(true);
    expect(verifyObserverPin("", hash)).toBe(false);
    expect(verifyObserverPin(String((Number(pin) + 1) % 1_000_000).padStart(6, "0"), hash)).toBe(false);
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
