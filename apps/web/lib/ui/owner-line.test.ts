import { describe, expect, it } from "vitest";
import { formatOwnerLine } from "./owner-line";

const NOW = new Date("2026-09-08T12:00:00Z").getTime();

describe("formatOwnerLine", () => {
  it("joins name, role label and relative time", () => {
    expect(formatOwnerLine({ name: "สมชาย", roleKey: "dispatcher", at: "2026-09-08T11:55:00Z", now: NOW })).toBe(
      "สมชาย · ผู้จัดสรรงาน · 5 นาทีที่แล้ว"
    );
  });
  it("drops role and time when not provided", () => {
    expect(formatOwnerLine({ name: "สมหญิง" })).toBe("สมหญิง");
  });
  it("falls back when there is no name", () => {
    expect(formatOwnerLine({ name: null })).toBe("ยังไม่ระบุผู้รับผิดชอบ");
    expect(formatOwnerLine({ name: "  " })).toBe("ยังไม่ระบุผู้รับผิดชอบ");
  });
});
