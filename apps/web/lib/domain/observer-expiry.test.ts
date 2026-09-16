import { describe, expect, it } from "vitest";
import { formatObserverExpiryLabel, getDefaultProjectObserverExpiry, normalizeFutureExpiry } from "./observer-expiry";

describe("getDefaultProjectObserverExpiry", () => {
  const now = new Date("2026-09-16T02:00:00.000Z");

  it("keeps a future project link alive until after the project ends", () => {
    expect(getDefaultProjectObserverExpiry("2026-10-01", { now })).toBe("2026-10-02T00:00:00.000Z");
  });

  it("never issues a project link that is already expired", () => {
    expect(getDefaultProjectObserverExpiry("2026-09-12", { now })).toBe("2026-09-23T02:00:00.000Z");
  });

  it("uses a 30-day fallback when no usable project end date exists", () => {
    expect(getDefaultProjectObserverExpiry(null, { now })).toBe("2026-10-16T02:00:00.000Z");
    expect(getDefaultProjectObserverExpiry("not-a-date", { now })).toBe("2026-10-16T02:00:00.000Z");
  });
});

describe("formatObserverExpiryLabel", () => {
  it("formats a visible operator label in Thai time", () => {
    expect(formatObserverExpiryLabel("2026-09-23T02:00:00.000Z")).toContain("2569");
  });
});

describe("normalizeFutureExpiry", () => {
  const now = new Date("2026-09-16T02:00:00.000Z");

  it("keeps an explicit future expiry", () => {
    expect(normalizeFutureExpiry("2026-09-20T16:59:59.999Z", { now })).toBe("2026-09-20T16:59:59.999Z");
  });

  it("rejects invalid or past explicit expiry values", () => {
    expect(normalizeFutureExpiry("2026-09-10T16:59:59.999Z", { now })).toBeNull();
    expect(normalizeFutureExpiry("not-a-date", { now })).toBeNull();
  });
});
