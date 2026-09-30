// The Airport Transfer import form, defined once: the downloadable template is
// built from this list and the importer reads files by it, so the two cannot
// drift apart. Change a column here and both follow.

export const TEMPLATE_VERSION = "tomp-at-import-v1";
export const DATA_SHEET = "กรอกข้อมูล";
export const HELP_SHEET = "วิธีกรอก";
export const DATA_SHEET_EN = "Passengers";
export const HELP_SHEET_EN = "How to fill";
/** Hidden: the values behind every dropdown. */
export const LISTS_SHEET = "_lists";
export const META_SHEET = "_tomp";
/** Row 1 Thai header, row 2 English header, row 3 an example the importer skips. */
export const FIRST_DATA_ROW = 4;

export type ImportField =
  | "direction"
  | "travelDate"
  | "flightNumber"
  | "passengerTitle"
  | "passengerFirstName"
  | "passengerLastName"
  | "passengerMobile"
  | "passengerEmail"
  | "passengerCount"
  | "luggageCount"
  | "placeName"
  | "placeAddress"
  | "placeMapsUrl"
  | "fastTrack"
  | "notes";

export interface ImportColumn {
  field: ImportField;
  th: string;
  en: string;
  required: boolean;
  example: string | number;
  /** Dropdown values in the template (data validation), Thai form. */
  choices?: string[];
  /** The same dropdown in the English form. */
  choicesEn?: string[];
  width: number;
  hint: string;
  hintEn: string;
  /** Other header texts that mean this column, for files not made from the template. */
  synonyms: string[];
}

export const DIRECTION_CHOICES = ["ขาเข้า (มาถึงไทย)", "ขาออก (ออกจากไทย)"];
export const TITLE_CHOICES = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "นาย", "นาง", "นางสาว"];
export const YES_NO_CHOICES = ["ใช่", "ไม่ใช่"];
export const DIRECTION_CHOICES_EN = ["Arrival (to Thailand)", "Departure (from Thailand)"];
export const TITLE_CHOICES_EN = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr."];
export const YES_NO_CHOICES_EN = ["Yes", "No"];
export type TemplateLanguage = "th" | "en";

export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    field: "direction",
    th: "ขาเดินทาง",
    en: "Direction",
    required: true,
    example: DIRECTION_CHOICES[0],
    choices: DIRECTION_CHOICES,
    choicesEn: DIRECTION_CHOICES_EN,
    width: 20,
    hint: "ขาเข้า = รับจากสนามบินไปที่พัก · ขาออก = รับจากที่พักไปสนามบิน",
    hintEn: "Arrival = airport to hotel · Departure = hotel to airport",
    synonyms: ["direction", "type", "arrival/departure", "ประเภท", "ขา"]
  },
  {
    field: "travelDate",
    th: "วันที่เที่ยวบิน",
    en: "Flight date",
    required: true,
    example: "2026-10-02",
    width: 16,
    hint: "เลือกวันที่จากรายการ (วันที่เครื่องออกหรือลงตามตั๋ว)",
    hintEn: "Pick the flight's date from the list (the day it departs or lands)",
    synonyms: ["date", "flight date", "travel date", "วันที่", "วันเดินทาง", "วันที่เดินทาง"]
  },
  {
    field: "flightNumber",
    th: "เที่ยวบิน",
    en: "Flight no.",
    required: true,
    example: "TG 661",
    width: 12,
    hint: "รหัสสายการบิน + เลข เช่น TG661, FD3021",
    hintEn: "Airline code + number, e.g. TG661, FD3021",
    synonyms: ["flight", "flight no", "flight number", "เที่ยวบิน", "หมายเลขเที่ยวบิน"]
  },
  {
    field: "passengerTitle",
    th: "คำนำหน้า",
    en: "Title",
    required: false,
    example: "Mr.",
    choices: TITLE_CHOICES,
    choicesEn: TITLE_CHOICES_EN,
    width: 10,
    hint: "เลือกจากรายการ",
    hintEn: "Pick from the list",
    synonyms: ["title", "prefix", "คำนำหน้า"]
  },
  {
    field: "passengerFirstName",
    th: "ชื่อ",
    en: "First name",
    required: true,
    example: "John",
    width: 16,
    hint: "ชื่อตามหนังสือเดินทาง",
    hintEn: "As in the passport",
    synonyms: ["first name", "firstname", "given name", "name", "ชื่อ", "ชื่อผู้โดยสาร"]
  },
  {
    field: "passengerLastName",
    th: "นามสกุล",
    en: "Last name",
    required: true,
    example: "Smith",
    width: 16,
    hint: "นามสกุลตามหนังสือเดินทาง",
    hintEn: "As in the passport",
    synonyms: ["last name", "lastname", "surname", "family name", "นามสกุล"]
  },
  {
    field: "passengerMobile",
    th: "มือถือ",
    en: "Mobile",
    required: false,
    example: "+66 81 234 5678",
    width: 16,
    hint: "ใส่รหัสประเทศถ้าเป็นเบอร์ต่างประเทศ",
    hintEn: "Include the country code for a foreign number",
    synonyms: ["mobile", "phone", "tel", "telephone", "เบอร์โทร", "โทรศัพท์", "มือถือ"]
  },
  {
    field: "passengerEmail",
    th: "อีเมล",
    en: "Email",
    required: false,
    example: "john.smith@example.com",
    width: 24,
    hint: "",
    hintEn: "",
    synonyms: ["email", "e-mail", "อีเมล", "อีเมล์"]
  },
  {
    field: "passengerCount",
    th: "จำนวนผู้โดยสาร",
    en: "Passengers",
    required: true,
    example: 1,
    width: 12,
    hint: "รวมตัวผู้โดยสารเอง (1–30)",
    hintEn: "Including the passenger (1–30)",
    synonyms: ["pax", "passengers", "passenger count", "จำนวนคน", "จำนวนผู้โดยสาร"]
  },
  {
    field: "luggageCount",
    th: "กระเป๋า",
    en: "Luggage",
    required: false,
    example: 2,
    width: 10,
    hint: "จำนวนใบ ไม่กรอก = 0",
    hintEn: "Number of bags; blank = 0",
    synonyms: ["luggage", "bags", "baggage", "กระเป๋า", "สัมภาระ"]
  },
  {
    field: "placeName",
    th: "โรงแรม / สถานที่",
    en: "Hotel / place",
    required: true,
    example: "Mandarin Oriental Bangkok",
    width: 28,
    hint: "ขาเข้า = ที่ส่ง · ขาออก = ที่รับ (อีกฝั่งคือสนามบินจากเที่ยวบิน)",
    hintEn: "Arrival = drop-off · Departure = pick-up (the other end is the flight's airport)",
    synonyms: ["hotel", "place", "address name", "pickup", "dropoff", "location", "โรงแรม", "ที่พัก", "สถานที่"]
  },
  {
    field: "placeAddress",
    th: "ที่อยู่",
    en: "Address",
    required: false,
    example: "48 Oriental Ave, Bangkok",
    width: 28,
    hint: "",
    hintEn: "",
    synonyms: ["address", "ที่อยู่"]
  },
  {
    field: "placeMapsUrl",
    th: "ลิงก์แผนที่",
    en: "Map link",
    required: false,
    example: "https://maps.app.goo.gl/...",
    width: 24,
    hint: "ลิงก์ Google Maps (ถ้ามี)",
    hintEn: "Google Maps link (optional)",
    synonyms: ["map", "maps", "google maps", "map link", "ลิงก์แผนที่", "แผนที่"]
  },
  {
    field: "fastTrack",
    th: "Fast Track",
    en: "Fast Track",
    required: false,
    example: "ไม่ใช่",
    choices: YES_NO_CHOICES,
    choicesEn: YES_NO_CHOICES_EN,
    width: 11,
    hint: "ต้องการบริการ Fast Track ที่สนามบินหรือไม่",
    hintEn: "Airport Fast Track service?",
    synonyms: ["fast track", "fasttrack", "fast-track"]
  },
  {
    field: "notes",
    th: "หมายเหตุ",
    en: "Notes",
    required: false,
    example: "ต้องการเบาะเด็ก 1 ที่",
    width: 28,
    hint: "",
    hintEn: "",
    synonyms: ["notes", "note", "remark", "remarks", "หมายเหตุ"]
  }
];
