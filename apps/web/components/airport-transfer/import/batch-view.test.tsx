// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ImportBatch, ImportRow } from "@/lib/airport-transfer/import/batch";

const commit = vi.fn(async () => ({ ok: true, message: "ok" }));
vi.mock("@/app/airport-transfer/import-actions", () => ({
  cancelAirportTransferImport: vi.fn(),
  commitAirportTransferImport: (...args: unknown[]) => commit(...(args as [])),
  recheckAirportTransferImport: vi.fn(),
  saveAirportTransferImportMapping: vi.fn(),
  setAirportTransferImportOps: vi.fn(),
  fixAirportTransferImportRow: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { ImportBatchView } = await import("./batch-view");

const batch: ImportBatch = {
  id: "b1",
  fileName: "form.xlsx",
  status: "ready",
  totalRows: 2,
  validRows: 1,
  warningRows: 1,
  errorRows: 0,
  createdAt: "2026-09-30T00:00:00Z",
  completedAt: null,
  meta: { projectId: "p1", clientName: null, isTemplate: true, sheetName: "กรอกข้อมูล", headers: ["ขาเดินทาง"], mapping: { direction: "ขาเดินทาง", travelDate: "d", flightNumber: "f", passengerFirstName: "n", passengerLastName: "l", passengerCount: "c", placeName: "p" }, truncated: false }
};
const data = { direction: "arrival" as const, travelDate: "2026-10-02", flightNumber: "TG661", passengerTitle: null, passengerFirstName: "A", passengerLastName: "B", passengerMobile: "081", passengerEmail: null, passengerCount: 1, luggageCount: 0, placeName: "Hotel", placeAddress: null, placeMapsUrl: null, fastTrack: false, notes: null };
const rows: ImportRow[] = [
  { id: "r1", rowNumber: 4, status: "valid", raw: {}, data, messages: [], caseId: null },
  { id: "r2", rowNumber: 5, status: "warning", raw: {}, data: { ...data, passengerFirstName: "C" }, messages: [{ level: "warning", text: "ไม่พบเที่ยวบิน" }], caseId: null }
];

afterEach(() => {
  cleanup();
  commit.mockClear();
});

describe("ImportBatchView selection", () => {
  it("ticks rows that passed, leaves rows with a note for the operator, and imports only what is ticked", () => {
    render(<ImportBatchView projectId="p1" projectCode="P" batch={batch} rows={rows} units={[]} />);
    expect((screen.getByLabelText("เลือกแถว 4") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("เลือกแถว 5") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByText(/นำเข้า 1 เคสที่เลือก/));
    expect(commit).toHaveBeenCalledWith("p1", "b1", ["r1"]);
  });

  it("select-all takes the rows with notes too", () => {
    render(<ImportBatchView projectId="p1" projectCode="P" batch={batch} rows={rows} units={[]} />);
    fireEvent.click(screen.getByText("เลือกทั้งหมด"));
    expect(screen.getByText(/นำเข้า 2 เคสที่เลือก/)).toBeTruthy();
  });

  it("shows unassigned rows as waiting for a vehicle", () => {
    render(<ImportBatchView projectId="p1" projectCode="P" batch={batch} rows={rows} units={[]} />);
    expect(screen.getAllByText("ยังไม่จัดรถ")).toHaveLength(2);
  });
});
