import { describe, expect, it } from "vitest";
import { describeDuration, describeThai, isBackwards, todayLocalDate } from "@/components/ui/datetime-field";

// These four decide what an operator reads back after choosing a date, and a
// wrong answer here is a driver sent on the wrong day. The time-only cases are
// the subtle ones: "09:30" is not a date, so the pair has to be anchored to a
// shared day before it can be measured at all.

describe("describeDuration", () => {
  it("measures a plain time range", () => {
    expect(describeDuration("09:30", "12:00")).toBe("2 ชม. 30 นาที");
    expect(describeDuration("08:00", "08:45")).toBe("45 นาที");
    expect(describeDuration("06:00", "10:00")).toBe("4 ชม.");
  });

  it("measures a datetime range across days", () => {
    expect(describeDuration("2026-09-15T22:00", "2026-09-16T02:30")).toBe("4 ชม. 30 นาที");
    expect(describeDuration("2026-09-15T08:00", "2026-09-17T08:00")).toBe("2 วัน");
  });

  it("says nothing when the range is incomplete or inverted", () => {
    expect(describeDuration("09:30", "")).toBe("");
    expect(describeDuration("", "12:00")).toBe("");
    expect(describeDuration("12:00", "09:30")).toBe("");
    expect(describeDuration("09:30", "09:30")).toBe("");
  });
});

describe("isBackwards", () => {
  it("catches an inverted time-only pair", () => {
    // Before the anchoring fix this compared two unparseable strings and always
    // said no, so an operator could save 14:00–09:00 without a word.
    expect(isBackwards("14:00", "09:00")).toBe(true);
    expect(isBackwards("09:00", "14:00")).toBe(false);
  });

  it("catches an inverted datetime pair", () => {
    expect(isBackwards("2026-09-16T08:00", "2026-09-15T08:00")).toBe(true);
    expect(isBackwards("2026-09-15T08:00", "2026-09-16T08:00")).toBe(false);
  });

  it("stays quiet on an incomplete pair", () => {
    expect(isBackwards("", "09:00")).toBe(false);
    expect(isBackwards("09:00", "")).toBe(false);
  });
});

describe("describeThai", () => {
  it("renders a date in Thai with the Buddhist year", () => {
    const text = describeThai("2026-09-15", false);
    expect(text).toContain("2569");
    expect(text).toContain("ก.ย.");
  });

  it("adds the clock when the value carries one", () => {
    expect(describeThai("2026-09-15T09:30", true)).toContain("น.");
  });

  it("returns nothing it cannot parse, so the caller shows its own placeholder", () => {
    expect(describeThai("", false)).toBe("");
    expect(describeThai("not-a-date", false)).toBe("");
  });
});

describe("todayLocalDate", () => {
  it("is the local day, not whatever UTC happens to be", () => {
    const value = todayLocalDate();
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    expect(value).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    );
  });
});
