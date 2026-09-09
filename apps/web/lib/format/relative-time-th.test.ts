import { describe, expect, it } from "vitest";
import { formatRelativeCompactTh, formatRelativeTh } from "./relative-time-th";

const NOW = new Date("2026-09-08T12:00:00Z").getTime();

describe("formatRelativeTh", () => {
  it("returns a placeholder for missing/invalid input", () => {
    expect(formatRelativeTh(null, NOW)).toBe("ยังไม่ระบุ");
    expect(formatRelativeTh(undefined, NOW)).toBe("ยังไม่ระบุ");
    expect(formatRelativeTh("not-a-date", NOW)).toBe("ยังไม่ระบุ");
  });

  it("collapses just-now and clock-skewed future stamps", () => {
    expect(formatRelativeTh("2026-09-08T11:59:58Z", NOW)).toBe("เมื่อสักครู่");
    expect(formatRelativeTh("2026-09-08T12:05:00Z", NOW)).toBe("เมื่อสักครู่");
  });

  it("shows seconds under a minute", () => {
    expect(formatRelativeTh("2026-09-08T11:59:30Z", NOW)).toBe("30 วินาทีที่แล้ว");
  });

  it("formats minutes, hours and days", () => {
    expect(formatRelativeTh("2026-09-08T11:55:00Z", NOW)).toBe("5 นาทีที่แล้ว");
    expect(formatRelativeTh("2026-09-08T09:00:00Z", NOW)).toBe("3 ชั่วโมงที่แล้ว");
    expect(formatRelativeTh("2026-09-06T12:00:00Z", NOW)).toBe("2 วันที่แล้ว");
  });

  it("rolls over to months and years", () => {
    expect(formatRelativeTh("2026-07-08T12:00:00Z", NOW)).toBe("2 เดือนที่แล้ว");
    expect(formatRelativeTh("2024-09-08T12:00:00Z", NOW)).toBe("2 ปีที่แล้ว");
  });

  it("accepts Date and epoch millis", () => {
    expect(formatRelativeTh(new Date("2026-09-08T11:55:00Z"), NOW)).toBe("5 นาทีที่แล้ว");
    expect(formatRelativeTh(NOW - 5 * 60_000, NOW)).toBe("5 นาทีที่แล้ว");
  });
});

describe("formatRelativeCompactTh", () => {
  it("returns a dash for missing input", () => {
    expect(formatRelativeCompactTh(null, NOW)).toBe("—");
  });

  it("uses short unit suffixes", () => {
    expect(formatRelativeCompactTh("2026-09-08T11:59:30Z", NOW)).toBe("30 วิ");
    expect(formatRelativeCompactTh("2026-09-08T11:55:00Z", NOW)).toBe("5 น.");
    expect(formatRelativeCompactTh("2026-09-08T09:00:00Z", NOW)).toBe("3 ชม.");
    expect(formatRelativeCompactTh("2026-09-06T12:00:00Z", NOW)).toBe("2 วัน");
  });
});
