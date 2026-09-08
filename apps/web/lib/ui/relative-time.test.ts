import { describe, expect, it } from "vitest";
import { formatRelativeTh } from "./relative-time";

const NOW = new Date("2026-09-08T12:00:00Z").getTime();

describe("formatRelativeTh", () => {
  it("returns a placeholder for missing/invalid input", () => {
    expect(formatRelativeTh(null, NOW)).toBe("ยังไม่ระบุ");
    expect(formatRelativeTh(undefined, NOW)).toBe("ยังไม่ระบุ");
    expect(formatRelativeTh("not-a-date", NOW)).toBe("ยังไม่ระบุ");
  });
  it("collapses sub-minute and future times to 'just now'", () => {
    expect(formatRelativeTh("2026-09-08T11:59:30Z", NOW)).toBe("เมื่อสักครู่");
    expect(formatRelativeTh("2026-09-08T12:05:00Z", NOW)).toBe("เมื่อสักครู่");
  });
  it("formats minutes, hours and days", () => {
    expect(formatRelativeTh("2026-09-08T11:55:00Z", NOW)).toBe("5 นาทีที่แล้ว");
    expect(formatRelativeTh("2026-09-08T09:00:00Z", NOW)).toBe("3 ชั่วโมงที่แล้ว");
    expect(formatRelativeTh("2026-09-06T12:00:00Z", NOW)).toBe("2 วันที่แล้ว");
  });
});
