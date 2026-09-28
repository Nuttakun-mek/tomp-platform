import "server-only";

import ExcelJS from "exceljs";
import type { DayCloseRow, DayCloseTotals } from "@/lib/domain/day-close";

const clock = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });

/** "07:00", or "3 ต.ค. 00:30" when the time falls on another day than the report. */
export function timeOnDay(iso: string | null, date: string) {
  if (!iso) return "";
  const at = new Date(iso);
  return bangkokDay.format(at) === date ? clock.format(at) : `${dayMonth.format(at)} ${clock.format(at)}`;
}

export async function buildDayCloseWorkbook(input: { projectCode: string; projectName: string; date: string; rows: DayCloseRow[]; totals: DayCloseTotals }) {
  const book = new ExcelJS.Workbook();
  book.creator = "TOMP";
  const sheet = book.addWorksheet(`สรุป ${input.date}`, { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.addRow([`สรุปปิดวัน ${input.projectName} (${input.projectCode}) · ${input.date}`]).font = { bold: true, size: 14 };
  sheet.addRow([`ออกรายงาน ${new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date())}`]).font = {
    italic: true,
    color: { argb: "FF64748B" }
  };
  const header = sheet.addRow([
    "Call Sign",
    "คนขับ",
    "ทะเบียน",
    "งานเสร็จ",
    "งานทั้งหมด",
    "เริ่มตามแผน",
    "จบตามแผน",
    "เข้างาน",
    "ออกงาน",
    "ชั่วโมงที่คิด",
    "OT (ชม.)",
    "ค่าบริการ (บ.)",
    "ค่า OT (บ.)",
    "รวม (บ.)",
    "หมายเหตุ"
  ]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  for (const row of input.rows) {
    const added = sheet.addRow([
      row.label,
      row.driverName ?? "",
      row.plate ?? "",
      row.jobsDone,
      row.jobs,
      timeOnDay(row.plannedStart, input.date),
      timeOnDay(row.plannedEnd, input.date),
      timeOnDay(row.clockIn, input.date),
      timeOnDay(row.clockOut, input.date),
      row.cost.billableHours ?? null,
      row.cost.extraHours ?? 0,
      row.cost.baseAmount ?? null,
      row.cost.extraAmount ?? null,
      row.cost.estimatedCost ?? null,
      row.notes.join(" · ")
    ]);
    if (row.cost.extraHours && row.cost.extraHours > 0) added.getCell(11).font = { bold: true, color: { argb: "FFB45309" } };
  }
  const totals = sheet.addRow([
    "รวม",
    `${input.totals.units} หน่วย`,
    "",
    input.totals.jobsDone,
    input.totals.jobs,
    "",
    "",
    "",
    "",
    input.totals.hours,
    input.totals.overtimeHours,
    input.totals.baseAmount,
    input.totals.overtimeAmount,
    input.totals.total,
    input.totals.unpriced ? `${input.totals.unpriced} หน่วยยังไม่มีอัตรา — ไม่รวมในยอด` : ""
  ]);
  totals.font = { bold: true };
  totals.eachCell((cell) => (cell.border = { top: { style: "thin" } }));

  const widths = [14, 20, 12, 9, 10, 11, 11, 11, 11, 11, 9, 13, 11, 13, 48];
  widths.forEach((width, index) => (sheet.getColumn(index + 1).width = width));
  for (const column of [10, 11]) sheet.getColumn(column).numFmt = "0.00";
  for (const column of [12, 13, 14]) sheet.getColumn(column).numFmt = "#,##0.00";

  return Buffer.from(await book.xlsx.writeBuffer());
}
