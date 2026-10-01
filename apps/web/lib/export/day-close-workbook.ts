import "server-only";

import ExcelJS from "exceljs";
import { totalsOf, type DayCloseDay, type DayCloseRow, type DayCloseTotals, type DayCloseUnitSummary } from "@/lib/domain/day-close";

const clock = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
const bangkokDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });
const longDay = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const issuedAt = () => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date());

/** "07:00", or "3 ต.ค. 00:30" when the time falls on another day than the report. */
export function timeOnDay(iso: string | null, date: string) {
  if (!iso) return "";
  const at = new Date(iso);
  return bangkokDay.format(at) === date ? clock.format(at) : `${dayMonth.format(at)} ${clock.format(at)}`;
}

export const dayLabel = (date: string) => longDay.format(new Date(`${date}T12:00:00+07:00`));

const UNIT_HEADERS = [
  "Call Sign",
  "คนขับ",
  "ทะเบียน",
  "งานเสร็จ",
  "งานทั้งหมด",
  "เข้างาน (กำหนด)",
  "ออกงาน (กำหนด)",
  "เลิกงาน (คิด OT หลังเวลานี้)",
  "เข้างานจริง",
  "ออกงานจริง",
  "ชั่วโมงที่คิด",
  "OT (ชม.)",
  "ค่าบริการ (บ.)",
  "ค่า OT (บ.)",
  "รวม (บ.)",
  "หมายเหตุ"
];
const UNIT_WIDTHS = [14, 20, 12, 9, 10, 11, 11, 13, 11, 11, 11, 9, 13, 11, 13, 48];

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

function titleRows(sheet: ExcelJS.Worksheet, title: string, subtitle?: string) {
  sheet.addRow([title]).font = { bold: true, size: 14 };
  sheet.addRow([subtitle ? `${subtitle} · ออกรายงาน ${issuedAt()}` : `ออกรายงาน ${issuedAt()}`]).font = { italic: true, color: { argb: "FF64748B" } };
}

function unitCells(row: DayCloseRow, date: string) {
  return [
    row.label,
    row.driverName ?? "",
    row.plate ?? "",
    row.jobsDone,
    row.jobs,
    timeOnDay(row.cost.dutyStart, date),
    timeOnDay(row.cost.scheduledEnd, date),
    timeOnDay(row.cost.dutyEnd, date),
    timeOnDay(row.clockIn, date),
    timeOnDay(row.clockOut, date),
    row.cost.scheduledHours + row.cost.overtimeHours,
    row.cost.overtimeHours,
    row.cost.baseAmount ?? null,
    row.cost.overtimeAmount ?? null,
    row.cost.total ?? null,
    row.notes.join(" · ")
  ];
}

function totalCells(label: string, totals: DayCloseTotals, lead: unknown[] = []) {
  return [
    ...lead,
    label,
    `${totals.units} หน่วย`,
    "",
    totals.jobsDone,
    totals.jobs,
    "",
    "",
    "",
    "",
    "",
    totals.hours,
    totals.overtimeHours,
    totals.baseAmount,
    totals.overtimeAmount,
    totals.total,
    totals.unpriced ? `${totals.unpriced} หน่วยยังไม่มีอัตรา — ไม่รวมในยอด` : ""
  ];
}

function formatColumns(sheet: ExcelJS.Worksheet, widths: number[], hourColumns: number[], moneyColumns: number[]) {
  widths.forEach((width, index) => (sheet.getColumn(index + 1).width = width));
  for (const column of hourColumns) sheet.getColumn(column).numFmt = "0.00";
  for (const column of moneyColumns) sheet.getColumn(column).numFmt = "#,##0.00";
}

/** One day: a row per unit and the day's total — the day-close page as a sheet. */
function addDaySheet(book: ExcelJS.Workbook, name: string, input: { projectCode: string; projectName: string; date: string; rows: DayCloseRow[]; totals: DayCloseTotals }) {
  const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  titleRows(sheet, `สรุปปิดวัน ${input.projectName} (${input.projectCode}) · ${dayLabel(input.date)}`);
  styleHeader(sheet.addRow(UNIT_HEADERS));
  for (const row of input.rows) {
    const added = sheet.addRow(unitCells(row, input.date));
    if (row.cost.overtimeHours > 0) added.getCell(12).font = { bold: true, color: { argb: "FFB45309" } };
  }
  const totals = sheet.addRow(totalCells("รวม", input.totals));
  totals.font = { bold: true };
  totals.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
  formatColumns(sheet, UNIT_WIDTHS, [11, 12], [13, 14, 15]);
  return sheet;
}

export async function buildDayCloseWorkbook(input: { projectCode: string; projectName: string; date: string; rows: DayCloseRow[]; totals: DayCloseTotals }) {
  const book = new ExcelJS.Workbook();
  book.creator = "TOMP";
  addDaySheet(book, `สรุป ${input.date}`, input);
  return Buffer.from(await book.xlsx.writeBuffer());
}

/**
 * The whole project (or the filtered part of it) in one file: a summary of
 * every day and unit with day subtotals, one line per Call Sign for billing,
 * then one sheet per day laid out like the daily export.
 */
export async function buildDayCloseRangeWorkbook(input: {
  projectCode: string;
  projectName: string;
  from: string;
  to: string;
  days: DayCloseDay[];
  units: DayCloseUnitSummary[];
  /** What the screen was filtered by, written under the title. */
  filterNote?: string;
}) {
  const book = new ExcelJS.Workbook();
  book.creator = "TOMP";
  const scope = `${dayLabel(input.from)} – ${dayLabel(input.to)}${input.filterNote ? ` · ${input.filterNote}` : ""}`;

  // Summary: every day, every unit, a subtotal per day and a grand total.
  const summary = book.addWorksheet("สรุป", { views: [{ state: "frozen", ySplit: 3 }] });
  titleRows(summary, `สรุปปิดวันทั้งโครงการ ${input.projectName} (${input.projectCode})`, scope);
  styleHeader(summary.addRow(["วันที่", ...UNIT_HEADERS]));
  for (const day of input.days) {
    for (const row of day.rows) {
      const added = summary.addRow([dayLabel(day.date), ...unitCells(row, day.date)]);
      if (row.cost.overtimeHours > 0) added.getCell(13).font = { bold: true, color: { argb: "FFB45309" } };
    }
    const subtotal = summary.addRow(totalCells(`รวมวัน`, day.totals, [dayLabel(day.date)]));
    subtotal.font = { bold: true };
    subtotal.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }));
  }
  const grand = summary.addRow(totalCells("รวมทั้งหมด", totalsOf(input.days.flatMap((day) => day.rows)), [`${input.days.length} วัน`]));
  grand.font = { bold: true };
  grand.eachCell((cell) => (cell.border = { top: { style: "double" } }));
  formatColumns(summary, [16, ...UNIT_WIDTHS], [12, 13], [14, 15, 16]);

  // Per Call Sign: what to bill each vehicle for the span.
  const byUnit = book.addWorksheet("ตาม Call Sign", { views: [{ state: "frozen", ySplit: 3 }] });
  titleRows(byUnit, `สรุปตาม Call Sign ${input.projectName} (${input.projectCode})`, scope);
  styleHeader(
    byUnit.addRow(["Call Sign", "คนขับ", "ทะเบียน", "วันทำงาน", "งานเสร็จ", "งานทั้งหมด", "ชั่วโมงที่คิด", "OT (ชม.)", "ค่าบริการ (บ.)", "ค่า OT (บ.)", "รวม (บ.)", "หมายเหตุ"])
  );
  for (const unit of input.units) {
    byUnit.addRow([
      unit.label,
      unit.driverName ?? "",
      unit.plate ?? "",
      unit.days,
      unit.jobsDone,
      unit.jobs,
      unit.hours,
      unit.overtimeHours,
      unit.baseAmount,
      unit.overtimeAmount,
      unit.total,
      unit.unpricedDays ? `${unit.unpricedDays} วันรถยังไม่มีอัตรา — ไม่รวมในยอด` : ""
    ]);
  }
  const sum = (pick: (unit: DayCloseUnitSummary) => number) => Math.round(input.units.reduce((total, unit) => total + pick(unit), 0) * 100) / 100;
  const unitTotal = byUnit.addRow([
    "รวม",
    `${input.units.length} หน่วย`,
    "",
    "",
    sum((unit) => unit.jobsDone),
    sum((unit) => unit.jobs),
    sum((unit) => unit.hours),
    sum((unit) => unit.overtimeHours),
    sum((unit) => unit.baseAmount),
    sum((unit) => unit.overtimeAmount),
    sum((unit) => unit.total),
    ""
  ]);
  unitTotal.font = { bold: true };
  unitTotal.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
  formatColumns(byUnit, [14, 22, 14, 10, 9, 10, 12, 10, 14, 12, 14, 36], [7, 8], [9, 10, 11]);

  // One sheet per day, named by its date (sheet names cannot hold "/" or ":").
  for (const day of input.days) addDaySheet(book, day.date, { projectCode: input.projectCode, projectName: input.projectName, ...day });

  return Buffer.from(await book.xlsx.writeBuffer());
}
