import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildDayCloseWorkbook, timeOnDay } = await import("./day-close-workbook");
const { summarizeDay } = await import("@/lib/domain/day-close");

const bkk = (date: string, clock: string) => new Date(`${date}T${clock}:00+07:00`).toISOString();

describe("day close export", () => {
  it("writes one row per unit and a totals row that matches the page", async () => {
    const { rows, totals } = summarizeDay({
      date: "2026-10-02",
      jobs: [{ id: "a", callSignId: "cs1", driverId: "d1", vehicleId: "v1", status: "completed", startTime: bkk("2026-10-02", "07:00"), endTime: bkk("2026-10-02", "17:00") }],
      units: [{ id: "cs1", label: "CS-01", driverId: "d1", driverName: "สมชาย", vehicleId: "v1", plate: "1กข 1234", vehicleMetadata: { packageHours: 10, packageAmount: 3000 } }],
      sessions: [
        { driverId: "d1", status: "work_started", at: bkk("2026-10-02", "07:00") },
        { driverId: "d1", status: "work_ended", at: bkk("2026-10-02", "18:00") }
      ],
      reported: {},
      openIssues: {}
    });
    const buffer = await buildDayCloseWorkbook({ projectCode: "EVT", projectName: "Event", date: "2026-10-02", rows, totals });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = book.worksheets[0];
    expect(sheet.getRow(4).getCell(1).value).toBe("CS-01");
    expect(sheet.getRow(4).getCell(12).value).toBe(1); // OT hours
    expect(sheet.getRow(5).getCell(1).value).toBe("รวม");
    expect(sheet.getRow(5).getCell(15).value).toBe(3300);
  });

  it("writes the project file: a summary, one line per Call Sign, then one sheet per day", async () => {
    const { buildDayCloseRangeWorkbook } = await import("./day-close-workbook");
    const { summarizeByUnit } = await import("@/lib/domain/day-close");
    const unit = { id: "cs1", label: "CS-01", driverId: "d1", driverName: "สมชาย", vehicleId: "v1", plate: "1กข 1234", vehicleMetadata: { packageHours: 10, packageAmount: 3000 } };
    const days = ["2026-10-02", "2026-10-03"].map((date) => ({
      date,
      ...summarizeDay({
        date,
        jobs: [{ id: date, callSignId: "cs1", driverId: "d1", vehicleId: "v1", status: "completed", startTime: bkk(date, "07:00"), endTime: bkk(date, "17:00") }],
        units: [unit],
        sessions: [
          { driverId: "d1", status: "work_started" as const, at: bkk(date, "07:00") },
          { driverId: "d1", status: "work_ended" as const, at: bkk(date, "17:00") }
        ],
        reported: {},
        openIssues: {}
      })
    }));
    const buffer = await buildDayCloseRangeWorkbook({ projectCode: "EVT", projectName: "Event", from: "2026-10-02", to: "2026-10-03", days, units: summarizeByUnit(days) });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["สรุป", "ตาม Call Sign", "2026-10-02", "2026-10-03"]);
    const perUnit = book.getWorksheet("ตาม Call Sign")!;
    expect(perUnit.getRow(4).values).toEqual(expect.arrayContaining(["CS-01", "สมชาย", "1กข 1234", 2, 6000]));
  });

  it("names the day when a time falls after midnight", () => {
    expect(timeOnDay(bkk("2026-10-02", "07:05"), "2026-10-02")).toMatch(/07:05/);
    expect(timeOnDay(bkk("2026-10-03", "00:30"), "2026-10-02")).toMatch(/ต\.ค\..*00:30/);
  });
});
