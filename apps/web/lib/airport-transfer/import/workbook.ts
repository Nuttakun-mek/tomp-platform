import ExcelJS from "exceljs";
import { DATA_SHEET, DATA_SHEET_EN, FIRST_DATA_ROW, HELP_SHEET, HELP_SHEET_EN, IMPORT_COLUMNS, LISTS_SHEET, META_SHEET, TEMPLATE_VERSION, type TemplateLanguage } from "./columns";
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

/** "2026-10-02 พฤ." / "2026-10-02 Thu": the ISO date leads, so the importer reads it; the weekday helps the customer pick. */
export function templateDateOptions(from: string, to: string, language: TemplateLanguage): string[] {
  const weekday = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", { weekday: "short", timeZone: "Asia/Bangkok" });
  const out: string[] = [];
  const start = Date.parse(`${from}T12:00:00+07:00`);
  const end = Date.parse(`${to}T12:00:00+07:00`);
  for (let at = start; Number.isFinite(at) && at <= end && out.length < 400; at += 86_400_000) {
    const day = new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    out.push(`${day} ${weekday.format(new Date(at))}`);
  }
  return out;
}

const COUNT_OPTIONS = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => String(from + index));

const HELP: Record<TemplateLanguage, { title: string; lines: string[]; column: string; about: string; choices: string; example: string; exampleNote: string }> = {
  th: {
    title: "แบบฟอร์มรับส่งสนามบิน",
    lines: [
      `กรอกที่ชีต "${DATA_SHEET}" หนึ่งแถวต่อผู้โดยสารหนึ่งเที่ยว เริ่มแถวที่ ${FIRST_DATA_ROW}`,
      "ช่องสีเหลืองและหัวคอลัมน์ที่มี * ต้องกรอก",
      "ช่องที่มีลูกศร ▾ ให้เลือกจากรายการ — รวมวันที่เที่ยวบิน ซึ่งมีเฉพาะวันในช่วงงาน",
      "ขาเข้า = รับจากสนามบินไปโรงแรม · ขาออก = รับจากโรงแรมไปสนามบิน",
      "ไม่ต้องใส่เวลา ระบบดึงเวลาเครื่องออก/ลงจากหมายเลขเที่ยวบินให้",
      "ผู้โดยสารหลายคนที่เดินทางด้วยกัน กรอกชื่อคนหลักแถวเดียว แล้วใส่จำนวนผู้โดยสารรวม",
      "อย่าเปลี่ยนชื่อชีตหรือหัวคอลัมน์ แถวที่ 3 เป็นตัวอย่าง ไม่ต้องลบ"
    ],
    column: "คอลัมน์",
    about: "คำอธิบาย",
    choices: "ตัวเลือก",
    example: "ตัวอย่าง",
    exampleNote: "← แถวตัวอย่าง ระบบไม่นำเข้า เริ่มกรอกแถวที่ 4"
  },
  en: {
    title: "Airport transfer form",
    lines: [
      `Fill in the "${DATA_SHEET_EN}" sheet, one row per passenger per trip, from row ${FIRST_DATA_ROW}`,
      "Yellow cells and columns marked * are required",
      "Cells with ▾ take a choice from the list — including the flight date, which lists only the event's days",
      "Arrival = airport to hotel · Departure = hotel to airport",
      "No times needed: the system reads departure and arrival times from the flight number",
      "Several passengers travelling together: one row for the lead passenger, with the total in Passengers",
      "Do not rename the sheet or the headers. Row 3 is an example; leave it"
    ],
    column: "Column",
    about: "Notes",
    choices: "Choices",
    example: "Example",
    exampleNote: "← example row, not imported — start on row 4"
  }
};

export async function buildImportTemplate(options: {
  projectCode: string;
  projectName: string;
  language?: TemplateLanguage;
  /** The days a flight date can be, "YYYY-MM-DD" (defaults: today and the next 60 days). */
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<Buffer> {
  const language = options.language ?? "th";
  const help = HELP[language];
  const book = new ExcelJS.Workbook();
  book.creator = "TOMP";
  book.created = new Date();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const from = options.dateFrom || today;
  const to = options.dateTo && options.dateTo >= from ? options.dateTo : new Date(Date.parse(`${from}T12:00:00+07:00`) + 60 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  // A flight can land the evening before the event starts or leave the morning after.
  const dates = templateDateOptions(
    new Date(Date.parse(`${from}T12:00:00+07:00`) - 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }),
    new Date(Date.parse(`${to}T12:00:00+07:00`) + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }),
    language
  );

  const sheet = book.addWorksheet(language === "th" ? DATA_SHEET : DATA_SHEET_EN, { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.columns = IMPORT_COLUMNS.map((column) => ({ key: column.field, width: column.width }));

  // Every dropdown's values live on a hidden sheet; a list longer than 255
  // characters (the event's dates) cannot sit inside the rule itself.
  const lists = book.addWorksheet(LISTS_SHEET, { state: "veryHidden" });
  const listRanges = new Map<string, string>();
  const addList = (key: string, values: string[]) => {
    const columnIndex = listRanges.size + 1;
    values.forEach((value, index) => (lists.getCell(index + 1, columnIndex).value = value));
    const letter = columnLetter(columnIndex - 1);
    listRanges.set(key, `'${LISTS_SHEET}'!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`);
  };
  addList("travelDate", dates);
  addList("passengerCount", COUNT_OPTIONS(1, 30));
  addList("luggageCount", COUNT_OPTIONS(0, 30));
  for (const column of IMPORT_COLUMNS) {
    const choices = language === "th" ? column.choices : column.choicesEn ?? column.choices;
    if (choices) addList(column.field, choices);
  }

  const top = sheet.getRow(1);
  const second = sheet.getRow(2);
  const example = sheet.getRow(3);
  IMPORT_COLUMNS.forEach((column, index) => {
    const primary = language === "th" ? column.th : column.en;
    const secondary = language === "th" ? column.en : column.th;
    const hint = language === "th" ? column.hint : column.hintEn;

    const head = top.getCell(index + 1);
    head.value = column.required ? `${primary} *` : primary;
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    head.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    if (hint) head.note = hint;

    const sub = second.getCell(index + 1);
    sub.value = secondary;
    sub.font = { italic: true, size: 9, color: { argb: "FF475569" } };
    sub.alignment = { horizontal: "center" };

    const choices = language === "th" ? column.choices : column.choicesEn ?? column.choices;
    const ex = example.getCell(index + 1);
    ex.value =
      column.field === "travelDate" ? dates[1] ?? dates[0] ?? "" : choices ? choices[column.field === "fastTrack" ? 1 : 0] : column.example;
    ex.font = { italic: true, color: { argb: EXAMPLE_FONT } };
  });
  top.height = 30;
  sheet.getCell(3, IMPORT_COLUMNS.length + 1).value = help.exampleNote;
  sheet.getCell(3, IMPORT_COLUMNS.length + 1).font = { italic: true, color: { argb: EXAMPLE_FONT } };

  IMPORT_COLUMNS.forEach((column, index) => {
    const range = listRanges.get(column.field);
    const validation: ExcelJS.DataValidation | null = range
      ? {
          type: "list",
          allowBlank: !column.required,
          formulae: [range],
          showErrorMessage: true,
          // A stop, not a warning: a value off the list is what breaks an import.
          errorStyle: "stop",
          errorTitle: language === "th" ? column.th : column.en,
          error: language === "th" ? "เลือกจากรายการในช่องนี้" : "Pick a value from this cell's list"
        }
      : null;
    for (let r = FIRST_DATA_ROW; r < FIRST_DATA_ROW + FORM_ROWS; r += 1) {
      const cell = sheet.getCell(r, index + 1);
      if (validation) cell.dataValidation = validation;
      if (column.required) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REQUIRED_FILL } };
      if (column.field === "travelDate" || column.field === "passengerMobile") cell.numFmt = "@";
    }
  });

  const helpSheet = book.addWorksheet(language === "th" ? HELP_SHEET : HELP_SHEET_EN);
  helpSheet.columns = [{ width: 24 }, { width: 80 }];
  helpSheet.addRow([`${help.title} · ${options.projectName} (${options.projectCode})`]).font = { bold: true, size: 14 };
  helpSheet.addRow([]);
  help.lines.forEach((line, index) => helpSheet.addRow([String(index + 1), line]));
  helpSheet.addRow([]);
  helpSheet.addRow([help.column, help.about]).font = { bold: true };
  for (const column of IMPORT_COLUMNS) {
    const choices = language === "th" ? column.choices : column.choicesEn ?? column.choices;
    const primary = language === "th" ? column.th : column.en;
    helpSheet.addRow([
      `${primary}${column.required ? " *" : ""}`,
      [language === "th" ? column.hint : column.hintEn, choices ? `${help.choices}: ${choices.join(" / ")}` : "", `${help.example}: ${column.field === "travelDate" ? dates[1] ?? "" : column.example}`]
        .filter(Boolean)
        .join(" · ")
    ]);
  }

  const meta = book.addWorksheet(META_SHEET, { state: "veryHidden" });
  meta.getCell("A1").value = TEMPLATE_VERSION;
  meta.getCell("A2").value = options.projectCode;
  meta.getCell("A3").value = language;

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
  const sheet = book.getWorksheet(DATA_SHEET) ?? book.getWorksheet(DATA_SHEET_EN) ?? book.worksheets.find((candidate) => candidate.state === "visible" && candidate.rowCount > 0);
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
