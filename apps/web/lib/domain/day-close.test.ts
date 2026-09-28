import { describe, expect, it } from "vitest";
import { summarizeDay, type DayCloseJob, type DayCloseUnit } from "./day-close";

const bkk = (date: string, clock: string) => new Date(`${date}T${clock}:00+07:00`).toISOString();
const DAY = "2026-10-02";
const unit: DayCloseUnit = { id: "cs1", label: "CS-01", driverId: "d1", driverName: "สมชาย", vehicleId: "v1", plate: "1กข 1234", vehicleMetadata: { packageHours: 10, packageAmount: 3000 } };
const job = (id: string, start: string, end: string, status = "completed"): DayCloseJob => ({
  id,
  callSignId: "cs1",
  driverId: "d1",
  vehicleId: "v1",
  status,
  startTime: bkk(DAY, start),
  endTime: bkk(DAY, end)
});

describe("summarizeDay", () => {
  it("prices the day once per unit, from first start to last end, against the real clock-in and out", () => {
    const { rows, totals } = summarizeDay({
      date: DAY,
      jobs: [job("a", "07:00", "12:00"), job("b", "12:00", "17:00")],
      units: [unit],
      sessions: [
        { driverId: "d1", status: "work_started", at: bkk(DAY, "06:50") },
        { driverId: "d1", status: "work_ended", at: bkk(DAY, "19:00") }
      ],
      reported: {},
      openIssues: {}
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ jobs: 2, jobsDone: 2 });
    // Counted from the planned start (07:00) to the clock-out (19:00): 12 h on a 10 h package.
    expect(rows[0].cost.extraHours).toBe(2);
    expect(totals.total).toBe(3600);
    expect(totals.overtimeAmount).toBe(600);
  });

  it("uses a clock-out after midnight for the shift that started on the day", () => {
    const { rows } = summarizeDay({
      date: DAY,
      jobs: [job("a", "18:00", "23:00")],
      units: [{ ...unit, vehicleMetadata: { packageHours: 5, packageAmount: 1500 } }],
      sessions: [
        { driverId: "d1", status: "work_started", at: bkk(DAY, "17:55") },
        { driverId: "d1", status: "work_ended", at: bkk("2026-10-03", "00:30") }
      ],
      reported: {},
      openIssues: {}
    });
    expect(rows[0].cost.extraHours).toBe(1.5);
  });

  it("notes what is missing instead of guessing silently", () => {
    const { rows, totals } = summarizeDay({
      date: DAY,
      jobs: [job("a", "07:00", "12:00", "planned"), job("x", "09:00", "10:00", "cancelled")],
      units: [{ ...unit, vehicleMetadata: {} }],
      sessions: [],
      reported: {},
      openIssues: { a: 1 }
    });
    expect(rows[0].jobs).toBe(1); // the cancelled job is not counted
    expect(rows[0].notes).toEqual(
      expect.arrayContaining([expect.stringContaining("ไม่ได้บันทึกเวลาเข้า"), expect.stringContaining("งานยังไม่ปิด 1"), expect.stringContaining("เหตุขัดข้องค้าง 1"), expect.stringContaining("ยังไม่มีอัตรา")])
    );
    expect(totals.unpriced).toBe(1);
  });

  it("leaves other days out, judged on the Bangkok calendar", () => {
    const early = { ...job("e", "06:00", "07:00"), startTime: bkk(DAY, "06:00") }; // 23:00 UTC the day before
    expect(summarizeDay({ date: DAY, jobs: [early], units: [unit], sessions: [], reported: {}, openIssues: {} }).rows).toHaveLength(1);
    expect(summarizeDay({ date: "2026-10-01", jobs: [early], units: [unit], sessions: [], reported: {}, openIssues: {} }).rows).toHaveLength(0);
  });
});
