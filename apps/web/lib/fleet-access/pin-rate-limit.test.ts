import { describe, expect, it } from "vitest";
import { FLEET_PIN_WINDOW_MS, fleetClientFingerprint, isFleetPinRateLimited } from "./pin-rate-limit";

describe("fleet PIN rate limit", () => {
  it("does not limit nine failures inside the window", () => {
    const now = 1_000_000;
    expect(isFleetPinRateLimited(Array.from({ length: 9 }, (_, index) => now - index * 1000), now)).toBe(false);
  });

  it("limits ten failures inside the window", () => {
    const now = 1_000_000;
    expect(isFleetPinRateLimited(Array.from({ length: 10 }, (_, index) => now - index * 1000), now)).toBe(true);
  });

  it("ignores failures older than the window", () => {
    const now = 1_000_000;
    const oldAttempts = Array.from({ length: 20 }, (_, index) => now - FLEET_PIN_WINDOW_MS - 1000 - index);
    expect(isFleetPinRateLimited(oldAttempts, now)).toBe(false);
  });

  it("fingerprints different clients differently", () => {
    expect(fleetClientFingerprint("203.0.113.1", "Safari")).not.toBe(fleetClientFingerprint("203.0.113.2", "Safari"));
    expect(fleetClientFingerprint("203.0.113.1", "Safari")).not.toBe(fleetClientFingerprint("203.0.113.1", "Chrome"));
  });
});
