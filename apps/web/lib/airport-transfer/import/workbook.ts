import ExcelJS from "exceljs";
import { DATA_SHEET, FIRST_DATA_ROW, HELP_SHEET, IMPORT_COLUMNS, META_SHEET, TEMPLATE_VERSION } from "./columns";
import type { CellValue, RawRow } from "./normalize";

// The spreadsheet side of the import: build the form a customer fills in, and
// read back whatever file comes in (the form, or the customer's own layout).

const MAX_ROWS = 500;
/** Rows of the form that get dropdowns, checks and the required-cell colour. */
const FORM_ROWS = 300;
const TEAL = "FF0F766E";
const REQUIRED_FILL = "FFFFF4D6";
const EXAMPLE_FONT = "FF94A3B8";

function columnLetter(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export async function buildImportTemplate(options: { projectCode: string; projectName: string }): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "TOMP";
  book.created = new Date();

  const sheet = book.addWorksheet(DATA_SHEET, { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.columns = IMPORT_COLUMNS.map((column) => ({ key: column.field, width: column.width }));

  const thai = sheet.getRow(1);
  const english = sheet.getRow(2);
  const example = sheet.getRow(3);
  IMPORT_COLUMNS.forEach((column, index) => {
    const th = thai.getCell(index + 1);
    th.value = column.required ? `${column.th} *` : column.th;
    th.font = { bold: true, color: { argb: "FFFFFFFF" } };
    th.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    th.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (column.hint) th.note = column.hint;

    const en = english.getCell(index + 1);
    en.value = column.en;
    en.font = { italic: true, size: 9, color: { argb: "FF475569" } };
    en.alignment = { horizontal: "center" };

    const ex = example.getCell(index + 1);
    ex.value = column.field === "travelDate" ? new Date(`${column.example}T00:00:00Z`) : column.example;
    ex.font = { italic: true, color: { argb: EXAMPLE_FONT } };
    if (column.field === "travelDate") ex.numFmt = "yyyy-mm-dd";
  });
  thai.height = 30;
  sheet.getCell(3, IMPORT_COLUMNS.length + 1).value = "← แถวตัวอย่าง ระบบไม่นำเข้า เริ่มกรอกแถวที่ 4";
  sheet.getCell(3, IMPORT_COLUMNS.length + 1).font = { italic: true, color: { argb: EXAMPLE_FONT } };

  IMPORT_COLUMNS.forEach((column, index) => {
    const validation: ExcelJS.DataValidation | null = column.choices
      ? {
          type: "list",
          allowBlank: !column.required,
          formulae: [`"${column.choices.join(",")}"`],
          showErrorMessage: true,
          errorStyle: "warning",
          errorTitle: column.th,
          error: `เลือกจากรายการ: ${column.choices.join(" / ")}`
        }
      : column.field === "travelDate"
        ? {
            type: "date",
            operator: "greaterThan",
            allowBlank: true,
            formulae: [new Date(Date.UTC(2020, 0, 1))],
            showErrorMessage: true,
            errorStyle: "warning",
            errorTitle: column.th,
            error: "ใส่เป็นวันที่ เช่น 2026-10-02"
          }
        : column.field === "passengerCount" || column.field === "luggageCount"
          ? {
              type: "whole",
              operator: "between",
              allowBlank: true,
              formulae: column.field === "passengerCount" ? [1, 99] : [0, 999],
              showErrorMessage: true,
              errorStyle: "warning",
              errorTitle: column.th,
              error: column.field === "passengerCount" ? "1–99 คน" : "0–999 ใบ"
            }
          : null;
    for (let r = FIRST_DATA_ROW; r < FIRST_DATA_ROW + FORM_ROWS; r += 1) {
      const cell = sheet.getCell(r, index + 1);
      if (validation) cell.dataValidation = validation;
      if (column.required) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REQUIRED_FILL } };
      if (column.field === "travelDate") cell.numFmt = "yyyy-mm-dd";
    }
  });

  const help = book.addWorksheet(HELP_SHEET);
  help.columns = [{ width: 22 }, { width: 70 }];
  help.addRow([`แบบฟอร์มรับส่งสนามบิน · ${options.projectName} (${options.projectCode})`]).font = { bold: true, size: 14 };
  help.addRow([]);
  for (const line of [
    ["1", `กรอกที่ชีต "${DATA_SHEET}" หนึ่งแถวต่อผู้โดยสารหนึ่งเที่ยว เริ่มแถวที่ ${FIRST_DATA_ROW}`],
    ["2", "ช่องสีเหลืองและหัวคอลัมน์ที่มี * ต้องกรอก"],
    ["3", "ขาเข้า = รับจากสนามบินไปโรงแรม · ขาออก = รับจากโรงแรมไปสนามบิน"],
    ["4", "ไม่ต้องใส่เวลา ระบบดึงเวลาเครื่องออก/ลงจากหมายเลขเที่ยวบินให้"],
    ["5", "ผู้โดยสารหลายคนที่เดินทางด้วยกัน กรอกชื่อคนหลักแถวเดียว แล้วใส่จำนวนผู้โดยสารรวม"],
    ["6", "อย่าเปลี่ยนชื่อชีตหรือหัวคอลัมน์ แถวที่ 3 เป็นตัวอย่าง ไม่ต้องลบ"]
  ]) {
    help.addRow(line);
  }
  help.addRow([]);
  help.addRow(["คอลัมน์", "คำอธิบาย"]).font = { bold: true };
  for (const column of IMPORT_COLUMNS) {
    help.addRow([`${column.th}${column.required ? " *" : ""}`, [column.hint, column.choices ? `ตัวเลือก: ${column.choices.join(" / ")}` : "", `ตัวอย่าง: ${column.example}`].filter(Boolean).join(" · ")]);
  }

  const meta = book.addWorksheet(META_SHEET, { state: "veryHidden" });
  meta.getCell("A1").value = TEMPLATE_VERSION;
  meta.getCell("A2").value = options.projectCode;

  return Buffer.from(await book.xlsx.writeBuffer());
}

export interface ReadWorkbook {
  isTemplate: boolean;
  templateVersion: string | null;
  sheetName: string;
  headers: string[];
  rows: Array<{ rowNumber: number; raw: RawRow }>;
  truncated: boolean;
}

function cellValue(value: ExcelJS.CellValue): CellValue {
  if (value == null) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text; // hyperlink
    if ("result" in value) return cellValue(value.result as ExcelJS.CellValue); // formula
  }
  return String(value);
}

export async function readImportWorkbook(buffer: ArrayBuffer): Promise<ReadWorkbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const templateVersion = String(book.getWorksheet(META_SHEET)?.getCell("A1").value ?? "") || null;
  const isTemplate = templateVersion === TEMPLATE_VERSION;
  const sheet = book.getWorksheet(DATA_SHEET) ?? book.worksheets.find((candidate) => candidate.state === "visible" && candidate.rowCount > 0);
  if (!sheet) throw new Error("ไม่พบชีตข้อมูลในไฟล์");

  // The template's headers are fixed (row 1, "*" marks required). Any other
  // file: the first row with at least three filled cells is the header.
  let headerRow = 1;
  if (!isTemplate) {
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r += 1) {
      const filled = (sheet.getRow(r).values as ExcelJS.CellValue[]).filter((value) => value != null && String(cellValue(value)).trim()).length;
      if (filled >= 3) {
        headerRow = r;
        break;
      }
    }
  }
  const headerCells = sheet.getRow(headerRow);
  const headers: string[] = [];
  for (let c = 1; c <= sheet.columnCount; c += 1) {
    const label = String(cellValue(headerCells.getCell(c).value) ?? "").replace(/\s*\*\s*$/, "").trim();
    headers.push(label || `คอลัมน์ ${columnLetter(c - 1)}`);
  }

  const firstRow = isTemplate ? FIRST_DATA_ROW : headerRow + 1;
  const rows: ReadWorkbook["rows"] = [];
  let truncated = false;
  for (let r = firstRow; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const raw: RawRow = {};
    let any = false;
    headers.forEach((header, index) => {
      const value = cellValue(row.getCell(index + 1).value);
      raw[header] = value;
      if (value != null && String(value).trim()) any = true;
    });
    if (!any) continue;
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    rows.push({ rowNumber: r, raw });
  }
  return { isTemplate, templateVersion, sheetName: sheet.name, headers, rows, truncated };
}
