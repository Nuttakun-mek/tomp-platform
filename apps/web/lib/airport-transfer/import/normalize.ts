import { IMPORT_COLUMNS, type ImportField } from "./columns";

// Turns one spreadsheet row, whatever the customer typed, into the fields a
// case needs — or says, in Thai, what is wrong with it. Pure: no network, no
// database. The flight check and the duplicate check come after this.

export type CellValue = string | number | boolean | Date | null;
export type RawRow = Record<string, CellValue>;
/** field → the header text of the column that holds it in this file. */
export type ColumnMapping = Partial<Record<ImportField, string>>;

export type MessageLevel = "error" | "warning";
export interface RowMessage {
  level: MessageLevel;
  field?: ImportField;
  text: string;
}

export interface NormalizedRow {
  direction: "arrival" | "departure" | null;
  travelDate: string | null;
  flightNumber: string | null;
  passengerTitle: string | null;
  passengerFirstName: string | null;
  passengerLastName: string | null;
  passengerMobile: string | null;
  passengerEmail: string | null;
  passengerCount: number | null;
  luggageCount: number;
  placeName: string | null;
  placeAddress: string | null;
  placeMapsUrl: string | null;
  fastTrack: boolean;
  notes: string | null;
}

function fold(value: string) {
  return value.toLowerCase().replace(/[\s._\-/()*]+/g, "");
}

/** Guess which header holds which field: exact template headers first, then synonyms. */
export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<string>();
  const folded = headers.map((header) => ({ header, key: fold(header) }));
  for (const column of IMPORT_COLUMNS) {
    const wanted = [column.th, column.en, ...column.synonyms].map(fold);
    const hit = folded.find((entry) => !taken.has(entry.header) && wanted.includes(entry.key));
    if (hit) {
      mapping[column.field] = hit.header;
      taken.add(hit.header);
    }
  }
  return mapping;
}

export function missingRequiredColumns(mapping: ColumnMapping): ImportField[] {
  return IMPORT_COLUMNS.filter((column) => column.required && !mapping[column.field]).map((column) => column.field);
}

function text(value: CellValue | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const out = String(value).trim();
  return out ? out : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-10-02 · 02/10/2026 · 2/10/26 · 02/10/2569 (Buddhist year) · a real date cell · an Excel serial. */
export function parseDateCell(value: CellValue | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    // exceljs gives date cells as UTC midnight of the typed day.
    return Number.isNaN(value.getTime()) ? null : `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  const raw = String(value).trim();
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(raw);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (year < 100) year += 2000;
  }
  if (year > 2400) year -= 543; // Buddhist era
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseDirection(value: CellValue | undefined): "arrival" | "departure" | null {
  const raw = text(value)?.toLowerCase();
  if (!raw) return null;
  if (/ขาเข้า|มาถึง|arriv|^in$|^arr/.test(raw)) return "arrival";
  if (/ขาออก|ออกจาก|depart|^out$|^dep/.test(raw)) return "departure";
  return null;
}

function parseYes(value: CellValue | undefined): boolean {
  if (typeof value === "boolean") return value;
  const raw = text(value)?.toLowerCase();
  return Boolean(raw && /^(ใช่|yes|y|true|1|ต้องการ|มี)$/.test(raw));
}

function parseCount(value: CellValue | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function normalizeFlightNumber(value: CellValue | undefined): string | null {
  const raw = text(value);
  return raw ? raw.replace(/[\s-]+/g, "").toUpperCase() : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRow(raw: RawRow, mapping: ColumnMapping, today: string): { data: NormalizedRow; messages: RowMessage[] } {
  const cell = (field: ImportField) => {
    const header = mapping[field];
    return header ? raw[header] : undefined;
  };
  const messages: RowMessage[] = [];
  const error = (field: ImportField, message: string) => messages.push({ level: "error", field, text: message });
  const warn = (field: ImportField, message: string) => messages.push({ level: "warning", field, text: message });

  const direction = parseDirection(cell("direction"));
  if (!direction) error("direction", text(cell("direction")) ? `ขาเดินทาง "${text(cell("direction"))}" ไม่ชัดเจน — ใช้ ขาเข้า หรือ ขาออก` : "ไม่ได้ระบุขาเดินทาง");

  const travelDate = parseDateCell(cell("travelDate"));
  if (!travelDate) error("travelDate", text(cell("travelDate")) ? `อ่านวันที่ "${text(cell("travelDate"))}" ไม่ได้` : "ไม่ได้ระบุวันที่เที่ยวบิน");
  else if (travelDate < today) warn("travelDate", "วันที่เที่ยวบินผ่านมาแล้ว");

  const flightNumber = normalizeFlightNumber(cell("flightNumber"));
  if (!flightNumber) error("flightNumber", "ไม่ได้ระบุเที่ยวบิน");
  else if (!/^([A-Z0-9]{2}|[A-Z]{3})\d{1,4}[A-Z]?$/.test(flightNumber)) error("flightNumber", `เที่ยวบิน "${flightNumber}" ไม่ใช่รูปแบบรหัสสายการบิน + เลข`);

  const passengerFirstName = text(cell("passengerFirstName"));
  if (!passengerFirstName) error("passengerFirstName", "ไม่ได้ระบุชื่อ");
  const passengerLastName = text(cell("passengerLastName"));
  if (!passengerLastName) error("passengerLastName", "ไม่ได้ระบุนามสกุล");

  const passengerEmail = text(cell("passengerEmail"));
  const emailOk = Boolean(passengerEmail && EMAIL.test(passengerEmail));
  if (passengerEmail && !emailOk) warn("passengerEmail", `อีเมล "${passengerEmail}" รูปแบบไม่ถูกต้อง — จะไม่นำเข้าอีเมลนี้`);

  const passengerMobile = text(cell("passengerMobile"));
  if (!passengerMobile && !emailOk) warn("passengerMobile", "ไม่มีทั้งเบอร์โทรและอีเมล ติดต่อผู้โดยสารไม่ได้");

  let passengerCount = parseCount(cell("passengerCount"));
  if (passengerCount == null) {
    passengerCount = 1;
    warn("passengerCount", "ไม่ได้ระบุจำนวนผู้โดยสาร ใช้ 1 คน");
  } else if (passengerCount < 1 || passengerCount > 99) {
    error("passengerCount", `จำนวนผู้โดยสาร ${passengerCount} ไม่อยู่ในช่วง 1–99`);
  }

  let luggageCount = parseCount(cell("luggageCount")) ?? 0;
  if (luggageCount < 0 || luggageCount > 999) {
    warn("luggageCount", `จำนวนกระเป๋า ${luggageCount} ไม่สมเหตุสมผล ใช้ 0`);
    luggageCount = 0;
  }

  const placeName = text(cell("placeName"));
  if (!placeName) error("placeName", direction === "departure" ? "ไม่ได้ระบุที่รับ (โรงแรม/สถานที่)" : "ไม่ได้ระบุที่ส่ง (โรงแรม/สถานที่)");

  const placeMapsUrl = text(cell("placeMapsUrl"));
  if (placeMapsUrl && !/^https?:\/\//i.test(placeMapsUrl)) warn("placeMapsUrl", "ลิงก์แผนที่ต้องขึ้นต้นด้วย http — จะไม่นำเข้าลิงก์นี้");

  return {
    data: {
      direction,
      travelDate,
      flightNumber,
      passengerTitle: text(cell("passengerTitle")),
      passengerFirstName,
      passengerLastName,
      passengerMobile,
      passengerEmail: emailOk ? passengerEmail : null,
      passengerCount,
      luggageCount,
      placeName,
      placeAddress: text(cell("placeAddress")),
      placeMapsUrl: placeMapsUrl && /^https?:\/\//i.test(placeMapsUrl) ? placeMapsUrl : null,
      fastTrack: parseYes(cell("fastTrack")),
      notes: text(cell("notes"))
    },
    messages
  };
}

/** A row the customer left empty (or only the example's greyed defaults). */
export function isBlankRow(raw: RawRow): boolean {
  return Object.values(raw).every((value) => value == null || (typeof value === "string" && !value.trim()));
}

/** The same passenger on the same flight and day — within a file, or against cases already in the system. */
export function duplicateKey(row: Pick<NormalizedRow, "flightNumber" | "travelDate" | "passengerFirstName" | "passengerLastName" | "direction">): string | null {
  if (!row.flightNumber || !row.travelDate || !row.passengerFirstName || !row.passengerLastName) return null;
  return [row.direction ?? "", row.travelDate, row.flightNumber, fold(row.passengerFirstName), fold(row.passengerLastName)].join("|");
}
