import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS } from "./columns";
import { duplicateKey, guessMapping, missingRequiredColumns, normalizeRow, parseDateCell, parseDirection } from "./normalize";

const TODAY = "2026-09-28";
const templateMapping = Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.field, column.th]));

function row(values: Record<string, unknown>) {
  return Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.th, (values[column.field] ?? null) as never]));
}

const good = {
  direction: "ขาเข้า (มาถึงไทย)",
  travelDate: "2026-10-02",
  flightNumber: "tg 661",
  passengerFirstName: "John",
  passengerLastName: "Smith",
  passengerMobile: "+66 81 234 5678",
  passengerCount: 2,
  placeName: "Mandarin Oriental"
};

describe("parseDateCell", () => {
  it("reads the ways people type a date, including the Buddhist year and Excel serials", () => {
    expect(parseDateCell("2026-10-02")).toBe("2026-10-02");
    expect(parseDateCell("02/10/2026")).toBe("2026-10-02");
    expect(parseDateCell("2/10/26")).toBe("2026-10-02");
    expect(parseDateCell("02/10/2569")).toBe("2026-10-02");
    expect(parseDateCell(new Date(Date.UTC(2026, 9, 2)))).toBe("2026-10-02");
    expect(parseDateCell(46297)).toBe("2026-10-02");
  });

  it("refuses dates that do not exist", () => {
    expect(parseDateCell("31/02/2026")).toBeNull();
    expect(parseDateCell("tomorrow")).toBeNull();
  });
});

describe("parseDirection", () => {
  it("understands Thai and English", () => {
    expect(parseDirection("ขาเข้า (มาถึงไทย)")).toBe("arrival");
    expect(parseDirection("Departure")).toBe("departure");
    expect(parseDirection("ขาออก")).toBe("departure");
    expect(parseDirection("maybe")).toBeNull();
  });
});

describe("guessMapping", () => {
  it("maps the template's own headers, and a customer's own headers by synonym", () => {
    expect(missingRequiredColumns(guessMapping(IMPORT_COLUMNS.map((column) => column.th)))).toEqual([]);
    const theirs = guessMapping(["Type", "Flight Date", "Flight No.", "First Name", "Surname", "Pax", "Hotel"]);
    expect(theirs).toMatchObject({
      direction: "Type",
      travelDate: "Flight Date",
      flightNumber: "Flight No.",
      passengerFirstName: "First Name",
      passengerLastName: "Surname",
      passengerCount: "Pax",
      placeName: "Hotel"
    });
    expect(missingRequiredColumns(theirs)).toEqual([]);
  });

  it("names the required columns it could not find", () => {
    expect(missingRequiredColumns(guessMapping(["Flight", "Name"]))).toContain("travelDate");
  });
});

describe("normalizeRow", () => {
  it("cleans a good row with no errors", () => {
    const { data, messages } = normalizeRow(row(good), templateMapping, TODAY);
    expect(messages.filter((m) => m.level === "error")).toEqual([]);
    expect(data).toMatchObject({ direction: "arrival", travelDate: "2026-10-02", flightNumber: "TG661", passengerCount: 2, luggageCount: 0, fastTrack: false });
  });

  it("says what is missing, in the field's terms", () => {
    const { messages } = normalizeRow(row({ ...good, flightNumber: null, placeName: null, direction: "?" }), templateMapping, TODAY);
    const errors = messages.filter((m) => m.level === "error").map((m) => m.field);
    expect(errors).toEqual(expect.arrayContaining(["flightNumber", "placeName", "direction"]));
  });

  it("warns without blocking: past date, bad email, no way to reach the passenger", () => {
    const { data, messages } = normalizeRow(
      row({ ...good, travelDate: "2026-09-01", passengerMobile: null, passengerEmail: "not-an-email" }),
      templateMapping,
      TODAY
    );
    expect(messages.every((m) => m.level === "warning")).toBe(true);
    expect(messages).toHaveLength(3);
    expect(data.passengerEmail).toBeNull();
  });
});

describe("duplicateKey", () => {
  it("treats case and spacing in names as the same passenger", () => {
    const a = normalizeRow(row(good), templateMapping, TODAY).data;
    const b = normalizeRow(row({ ...good, passengerFirstName: " john ", passengerLastName: "SMITH" }), templateMapping, TODAY).data;
    expect(duplicateKey(a)).toBe(duplicateKey(b));
  });
});
