"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { fixAirportTransferImportRow } from "@/app/airport-transfer/import-actions";
import { IMPORT_COLUMNS, TITLE_CHOICES, type ImportField } from "@/lib/airport-transfer/import/columns";
import { parseDateCell, parseDirection, type ColumnMapping, type RawRow } from "@/lib/airport-transfer/import/normalize";

const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-[13px]";

function initialValues(raw: RawRow, mapping: ColumnMapping): Partial<Record<ImportField, string>> {
  const out: Partial<Record<ImportField, string>> = {};
  for (const column of IMPORT_COLUMNS) {
    const header = mapping[column.field];
    if (!header) continue;
    const value = raw[header];
    if (column.field === "travelDate") out.travelDate = parseDateCell(value) ?? "";
    else if (column.field === "direction") out.direction = parseDirection(value) ?? "";
    else out[column.field] = value == null ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  }
  return out;
}

/**
 * Fix a row that failed a check (or complete what is missing) right here —
 * no editing the file and uploading it again. Only columns the file has can
 * be filled; the row is checked again on save.
 */
export function RowFixForm({
  projectId,
  batchId,
  rowId,
  raw,
  mapping,
  onDone
}: {
  projectId: string;
  batchId: string;
  rowId: string;
  raw: RawRow;
  mapping: ColumnMapping;
  onDone: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(() => initialValues(raw, mapping));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (field: ImportField, value: string) => setValues((current) => ({ ...current, [field]: value }));

  function save() {
    setError(null);
    // Choices are sent the way the form spells them, so the normal checks read them.
    const payload = { ...values };
    if (payload.direction === "arrival") payload.direction = "ขาเข้า";
    if (payload.direction === "departure") payload.direction = "ขาออก";
    startTransition(async () => {
      const result = await fixAirportTransferImportRow(projectId, batchId, rowId, payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  const field = (column: (typeof IMPORT_COLUMNS)[number]) => {
    const value = values[column.field] ?? "";
    const common = { "aria-label": column.th, value, onChange: (event: { target: { value: string } }) => set(column.field, event.target.value), className: input };
    switch (column.field) {
      case "direction":
        return (
          <select {...common}>
            <option value="">— เลือก —</option>
            <option value="arrival">ขาเข้า (มาถึงไทย)</option>
            <option value="departure">ขาออก (ออกจากไทย)</option>
          </select>
        );
      case "travelDate":
        return <input type="date" {...common} />;
      case "passengerTitle":
        return (
          <select {...common}>
            <option value="">—</option>
            {TITLE_CHOICES.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        );
      case "fastTrack":
        return (
          <select {...common}>
            <option value="ไม่ใช่">ไม่ใช่</option>
            <option value="ใช่">ใช่</option>
          </select>
        );
      case "passengerCount":
      case "luggageCount":
        return <input type="number" min={column.field === "passengerCount" ? 1 : 0} max={99} {...common} />;
      default:
        return <input {...common} />;
    }
  };

  const editable = IMPORT_COLUMNS.filter((column) => mapping[column.field]);
  const missing = IMPORT_COLUMNS.filter((column) => !mapping[column.field]);

  return (
    <div className="grid gap-2 rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {editable.map((column) => (
          <label key={column.field} className="grid gap-1 text-[11px] font-semibold text-slate-600">
            <span>
              {column.th}
              {column.required ? <span className="ml-0.5 text-rose-600">*</span> : null}
            </span>
            {field(column)}
          </label>
        ))}
      </div>
      {missing.length ? <p className="text-[11px] text-slate-500">ไฟล์นี้ไม่มีคอลัมน์ {missing.map((column) => column.th).join(", ")} — เติมได้ที่หน้าเคสหลังนำเข้า</p> : null}
      {error ? <p className="text-[12px] font-semibold text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-cyan-800 px-3 text-[12px] font-semibold text-white disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} บันทึกและตรวจใหม่
        </button>
        <button type="button" onClick={onDone} disabled={pending} className="min-h-8 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-600">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
