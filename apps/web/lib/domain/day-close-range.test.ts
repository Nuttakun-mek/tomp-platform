import { describe, expect, it } from "vitest";
import { filterDayCloseDays, rowFlags, summarizeByUnit, summarizeDay, type DayCloseDay, type DayCloseUnit } from "./day-close";
import { describeDayCloseFilter, parseDayCloseFilter } from "./day-close-filter";

const bkk = (date: string, clock: string) => new Date(`${date}T${clock}:00+07:00`).toISOString();
const van: DayCloseUnit = { id: "11111111-1111-4111-8111-111111111111", label: "Van-01", driverId: "d1", driverName: "สมชาย ใจดี", vehicleId: "v1", plate: "กบง 123", vehicleMetadata: { packageHours: 10, packageAmount: 3000 } };
const bus: DayCloseUnit = { id: "22222222-2222-4222-8222-222222222222", label: "Bus-01", driverId: "d2", driverName: "สมหญิง", vehicleId: "v2", plate: "1กข 99", vehicleMetadata: { packageHours: 10, packageAmount: 5000 } };

function day(date: string, sessions: Array<{ driverId: string; status: "work_started" | "work_ended"; at: string }>): DayCloseDay {
  const jobs = [
    { id: `${date}-a`, callSignId: van.id, driverId: "d1", vehicleId: "v1", status: "completed", startTime: bkk(date, "08:00"), endTime: bkk(date, "18:00") },
    { id: `${date}-b`, callSignId: bus.id, driverId: "d2", vehicleId: "v2", status: "completed", startTime: bkk(date, "08:00"), endTime: bkk(date, "18:00") }
  ];
  return { date, ...summarizeDay({ date, jobs, units: [van, bus], sessions, reported: {}, openIssues: {} }) };
}

const days = [
  day("2026-10-01", [
    { driverId: "d1", status: "work_started", at: bkk("2026-10-01", "08:00") },
    { driverId: "d1", status: "work_ended", at: bkk("2026-10-01", "19:00") },
    { driverId: "d2", status: "work_started", at: bkk("2026-10-01", "08:00") },
    { driverId: "d2", status: "work_ended", at: bkk("2026-10-01", "18:00") }
  ]),
  day("2026-10-02", [
    { driverId: "d1", status: "work_started", at: bkk("2026-10-02", "08:00") },
    { driverId: "d1", status: "work_ended", at: bkk("2026-10-02", "18:00") },
    { driverId: "d2", status: "work_started", at: bkk("2026-10-02", "08:00") }
  ])
];

describe("day close across the project", () => {
  it("flags what needs a second look", () => {
    expect(rowFlags(days[0].rows.find((row) => row.label === "Van-01")!)).toContain("ot");
    expect(rowFlags(days[1].rows.find((row) => row.label === "Bus-01")!)).toContain("no_clock_out");
  });

  it("filters by unit and by flag, recounting totals and dropping empty days", () => {
    const onlyVan = filterDayCloseDays(days, { units: [van.id] });
    expect(onlyVan.map((d) => d.rows.length)).toEqual([1, 1]);
    expect(onlyVan[0].totals.total).toBe(3300);

    const onlyOt = filterDayCloseDays(days, { flags: ["ot"] });
    expect(onlyOt).toHaveLength(1);
    expect(onlyOt[0].date).toBe("2026-10-01");
  });

  it("sums each Call Sign over the days, with its driver and plate", () => {
    const units = summarizeByUnit(days);
    const vanLine = units.find((unit) => unit.label === "Van-01")!;
    expect(vanLine).toMatchObject({ driverName: "สมชาย ใจดี", plate: "กบง 123", days: 2, overtimeHours: 1, total: 6300 });
  });

  it("reads the filter from the URL, and keeps bad values out", () => {
    const filter = parseDayCloseFilter({ from: "2026-10-02", to: "2026-10-01", unit: [van.id, "x"], flag: ["ot", "nope"] }, { from: "2026-09-30", to: "2026-10-05" });
    expect(filter).toEqual({ from: "2026-10-02", to: "2026-10-02", units: [van.id], flags: ["ot"] });
    expect(describeDayCloseFilter(filter, () => "Van-01")).toBe("Van-01 · มี OT");
  });
});
