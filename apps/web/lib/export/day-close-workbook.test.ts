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
    expect(sheet.getRow(4).getCell(11).value).toBe(1); // OT hours
    expect(sheet.getRow(5).getCell(1).value).toBe("รวม");
    expect(sheet.getRow(5).getCell(14).value).toBe(3300);
  });

  it("names the day when a time falls after midnight", () => {
    expect(timeOnDay(bkk("2026-10-02", "07:05"), "2026-10-02")).toMatch(/07:05/);
    expect(timeOnDay(bkk("2026-10-03", "00:30"), "2026-10-02")).toMatch(/ต\.ค\..*00:30/);
  });
});
