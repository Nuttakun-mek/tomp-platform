import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { DATA_SHEET, FIRST_DATA_ROW, IMPORT_COLUMNS } from "./columns";
import { guessMapping, missingRequiredColumns, normalizeRow } from "./normalize";
import { buildImportTemplate, readImportWorkbook } from "./workbook";

async function fill(buffer: Buffer, rows: Array<Array<unknown>>) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = book.getWorksheet(DATA_SHEET)!;
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
