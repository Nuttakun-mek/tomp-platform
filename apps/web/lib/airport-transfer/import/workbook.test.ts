import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { DATA_SHEET, DATA_SHEET_EN, FIRST_DATA_ROW, IMPORT_COLUMNS } from "./columns";
import { guessMapping, missingRequiredColumns, normalizeRow } from "./normalize";
import { buildImportTemplate, readImportWorkbook, templateDateOptions } from "./workbook";

async function fill(buffer: Buffer, rows: Array<Array<unknown>>, sheetName = DATA_SHEET) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = book.getWorksheet(sheetName)!;
  rows.forEach((values, i) => values.forEach((value, c) => (sheet.getCell(FIRST_DATA_ROW + i, c + 1).value = value as ExcelJS.CellValue)));
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe("the import template", () => {
  it("round-trips: what a customer types into the form comes back as a clean row", async () => {
    const template = await buildImportTemplate({ projectCode: "EVT-1", projectName: "Event" });
    const filled = await fill(template, [
      ["ขาเข้า (มาถึงไทย)", new Date(Date.UTC(2026, 9, 2)), "TG 661", "Mr.", "John", "Smith", "+66812345678", "", 2, 3, "Mandarin Oriental", "", "", "ใช่", "เบาะเด็ก"]
    ]);
    const read = await readImportWorkbook(filled as unknown as ArrayBuffer);
    expect(read.isTemplate).toBe(true);
    expect(read.rows).toHaveLength(1); // the example row is skipped
    const mapping = guessMapping(read.headers);
    expect(missingRequiredColumns(mapping)).toEqual([]);
    const { data, messages } = normalizeRow(read.rows[0].raw, mapping, "2026-09-28");
    expect(messages.filter((m) => m.level === "error")).toEqual([]);
    expect(data).toMatchObject({ direction: "arrival", travelDate: "2026-10-02", flightNumber: "TG661", passengerCount: 2, luggageCount: 3, fastTrack: true });
  });

  it("has a header for every column, required ones marked", async () => {
    const read = await readImportWorkbook((await buildImportTemplate({ projectCode: "X", projectName: "X" })) as unknown as ArrayBuffer);
    expect(read.headers.slice(0, IMPORT_COLUMNS.length)).toEqual(IMPORT_COLUMNS.map((column) => column.th));
    expect(read.rows).toEqual([]);
  });

  it("reads a customer's own sheet, finding the header row below a title", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Manifest");
    sheet.addRow(["Guest list — October"]);
    sheet.addRow(["Type", "Flight Date", "Flight No.", "First Name", "Surname", "Pax", "Hotel"]);
    sheet.addRow(["Departure", "03/10/2026", "FD3021", "Anna", "Lee", 1, "Siam Kempinski"]);
    const read = await readImportWorkbook((await book.xlsx.writeBuffer()) as ArrayBuffer);
    expect(read.isTemplate).toBe(false);
    expect(read.rows).toHaveLength(1);
    const { data, messages } = normalizeRow(read.rows[0].raw, guessMapping(read.headers), "2026-09-28");
    expect(messages.filter((m) => m.level === "error")).toEqual([]);
    expect(data).toMatchObject({ direction: "departure", travelDate: "2026-10-03", placeName: "Siam Kempinski" });
  });
});

describe("the template's dropdowns and English version", () => {
  it("offers the event's days (and one either side) as the flight date, and the importer reads the picked value", async () => {
    const options = templateDateOptions("2026-10-01", "2026-10-03", "th");
    expect(options[0]).toMatch(/^2026-10-01 /);
    const template = await buildImportTemplate({ projectCode: "EVT", projectName: "Event", dateFrom: "2026-10-02", dateTo: "2026-10-03" });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(template as unknown as ArrayBuffer);
    const dateCell = book.getWorksheet(DATA_SHEET)!.getCell(FIRST_DATA_ROW, 2);
    expect(dateCell.dataValidation?.type).toBe("list");
    const lists = book.getWorksheet("_lists")!;
    expect(lists.getCell(1, 1).value).toMatch(/^2026-10-01 /); // the day before the event
    expect(lists.getCell(4, 1).value).toMatch(/^2026-10-04 /); // the day after

    const filled = await fill(template, [["ขาออก (ออกจากไทย)", String(lists.getCell(2, 1).value), "FD3021", "", "Anna", "Lee", "+6681", "", "1", "0", "Siam Kempinski", "", "", "ไม่ใช่", ""]]);
    const read = await readImportWorkbook(filled as unknown as ArrayBuffer);
    const { data, messages } = normalizeRow(read.rows[0].raw, guessMapping(read.headers), "2026-09-28");
    expect(messages.filter((m) => m.level === "error")).toEqual([]);
    expect(data).toMatchObject({ direction: "departure", travelDate: "2026-10-02", passengerCount: 1 });
  });

  it("has an English version the importer reads the same way", async () => {
    const template = await buildImportTemplate({ projectCode: "EVT", projectName: "Event", language: "en", dateFrom: "2026-10-02", dateTo: "2026-10-03" });
    const filled = await fill(template, [["Arrival (to Thailand)", "2026-10-02 Fri", "TG 661", "Mr.", "John", "Smith", "+6681", "", "2", "1", "Mandarin Oriental", "", "", "Yes", ""]], DATA_SHEET_EN);
    const read = await readImportWorkbook(filled as unknown as ArrayBuffer);
    expect(read.isTemplate).toBe(true);
    expect(missingRequiredColumns(guessMapping(read.headers))).toEqual([]);
    const { data, messages } = normalizeRow(read.rows[0].raw, guessMapping(read.headers), "2026-09-28");
    expect(messages.filter((m) => m.level === "error")).toEqual([]);
    expect(data).toMatchObject({ direction: "arrival", travelDate: "2026-10-02", flightNumber: "TG661", fastTrack: true, passengerCount: 2 });
  });
});
