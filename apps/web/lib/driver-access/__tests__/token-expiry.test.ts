import { describe, expect, it } from "vitest";
import { driverTokenExpiryFor } from "../token";

const NOW = new Date("2026-09-25T03:00:00.000Z").getTime(); // 10:00 Bangkok

describe("driverTokenExpiryFor", () => {
  it("lasts until the end of the project's last day, Bangkok time", () => {
    expect(driverTokenExpiryFor("2026-10-10", NOW)).toBe("2026-10-10T16:59:59.000Z");
  });

  it("never gives less than 24 hours, even on a project ending today", () => {
    expect(driverTokenExpiryFor("2026-09-25", NOW)).toBe("2026-09-26T03:00:00.000Z");
  });

  it("accepts the Date the Postgres driver returns for a date column", () => {
    expect(driverTokenExpiryFor(new Date("2026-10-10T00:00:00.000Z"), NOW)).toBe("2026-10-10T16:59:59.000Z");
  });

  it("falls back to 24 hours without a usable end date", () => {
    expect(driverTokenExpiryFor(null, NOW)).toBe("2026-09-26T03:00:00.000Z");
    expect(driverTokenExpiryFor("not-a-date", NOW)).toBe("2026-09-26T03:00:00.000Z");
  });
});
