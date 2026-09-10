import { describe, expect, it } from "vitest";
import {
  deviceBindPatch,
  PIN_LOCK_MS,
  PIN_MAX_ATTEMPTS,
  pinFailurePatch,
  pinLockedMessage,
  readPinLock
} from "./driver-pin-lock";

const NOW = new Date("2026-09-10T09:00:00Z").getTime();

describe("readPinLock", () => {
  it("reports a clean slate for a token that has never been tried", () => {
    expect(readPinLock({}, NOW)).toEqual({ attempts: 0, locked: false, retryAfterSeconds: 0 });
    expect(readPinLock(null, NOW)).toEqual({ attempts: 0, locked: false, retryAfterSeconds: 0 });
  });

  it("carries wrong attempts forward while the window is open", () => {
    expect(readPinLock({ pinAttempts: 3 }, NOW)).toMatchObject({ attempts: 3, locked: false });
  });

  it("locks while pinLockedUntil is in the future and counts the remaining seconds", () => {
    const meta = { pinAttempts: 0, pinLockedUntil: new Date(NOW + 90_000).toISOString() };
    expect(readPinLock(meta, NOW)).toEqual({ attempts: 0, locked: true, retryAfterSeconds: 90 });
  });

  it("clears the counter once the cooldown has been served", () => {
    const meta = { pinAttempts: 4, pinLockedUntil: new Date(NOW - 1000).toISOString() };
    expect(readPinLock(meta, NOW)).toEqual({ attempts: 0, locked: false, retryAfterSeconds: 0 });
  });

  it("ignores an unparseable lock stamp instead of locking forever", () => {
    expect(readPinLock({ pinLockedUntil: "never" }, NOW)).toMatchObject({ locked: false });
  });
});

describe("pinFailurePatch", () => {
  it("counts up and reports the tries left", () => {
    const patch = pinFailurePatch({ attempts: 1, locked: false, retryAfterSeconds: 0 }, NOW);
    expect(patch).toEqual({ pinAttempts: 2, pinLockedUntil: null, remaining: PIN_MAX_ATTEMPTS - 2 });
  });

  it("starts the 15-minute cooldown on the last allowed try, and resets the counter", () => {
    const patch = pinFailurePatch({ attempts: PIN_MAX_ATTEMPTS - 1, locked: false, retryAfterSeconds: 0 }, NOW);
    expect(patch.remaining).toBe(0);
    expect(patch.pinAttempts).toBe(0);
    expect(new Date(String(patch.pinLockedUntil)).getTime()).toBe(NOW + PIN_LOCK_MS);
  });

  it("never revokes the link — a locked token is still readable after the wait", () => {
    const patch = pinFailurePatch({ attempts: PIN_MAX_ATTEMPTS - 1, locked: false, retryAfterSeconds: 0 }, NOW);
    const later = readPinLock({ pinAttempts: patch.pinAttempts, pinLockedUntil: patch.pinLockedUntil }, NOW + PIN_LOCK_MS + 1);
    expect(later).toEqual({ attempts: 0, locked: false, retryAfterSeconds: 0 });
  });
});

describe("deviceBindPatch", () => {
  it("binds a fresh token without recording a takeover", () => {
    expect(deviceBindPatch("", "device-a", undefined, NOW)).toEqual({
      deviceHash: "device-a",
      deviceRebindings: undefined,
      rebound: false
    });
  });

  it("is a no-op for the phone that already holds the job", () => {
    expect(deviceBindPatch("device-a", "device-a", [], NOW)).toMatchObject({ rebound: false });
  });

  it("records who held the job when a different phone takes it over", () => {
    const patch = deviceBindPatch("device-a", "device-b", undefined, NOW);
    expect(patch.rebound).toBe(true);
    expect(patch.deviceHash).toBe("device-b");
    expect(patch.deviceRebindings).toEqual([{ from: "device-a", at: new Date(NOW).toISOString() }]);
  });

  it("keeps only the five most recent takeovers", () => {
    const history = Array.from({ length: 6 }, (_, index) => ({ from: `old-${index}`, at: new Date(NOW).toISOString() }));
    const patch = deviceBindPatch("device-a", "device-b", history, NOW);
    expect(patch.deviceRebindings).toHaveLength(5);
    expect((patch.deviceRebindings as Array<{ from: string }>)[4].from).toBe("device-a");
  });
});

describe("pinLockedMessage", () => {
  it("rounds up to whole minutes and never says zero", () => {
    expect(pinLockedMessage(61)).toContain("2 นาที");
    expect(pinLockedMessage(5)).toContain("1 นาที");
  });

  it("tells the driver they do not need a new QR", () => {
    expect(pinLockedMessage(600)).toContain("ไม่ต้องขอ QR ใหม่");
  });
});
