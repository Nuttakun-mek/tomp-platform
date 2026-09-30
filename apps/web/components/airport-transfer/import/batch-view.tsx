"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleX, Copy, Loader2, Plane, RefreshCw } from "lucide-react";
import {
  cancelAirportTransferImport,
  commitAirportTransferImport,
  recheckAirportTransferImport,
  saveAirportTransferImportMapping,
  type ImportActionState
} from "@/app/airport-transfer/import-actions";
import type { ImportBatch, ImportRow, RowStatus } from "@/lib/airport-transfer/import/batch";
import { IMPORT_COLUMNS, type ImportField } from "@/lib/airport-transfer/import/columns";
import { missingRequiredColumns, type ColumnMapping } from "@/lib/airport-transfer/import/normalize";
import { RowFixForm } from "./row-fix-form";

const STATUS: Record<RowStatus, { label: string; className: string }> = {
  valid: { label: "ผ่าน", className: "bg-emerald-50 text-emerald-800" },
  warning: { label: "ผ่าน มีข้อสังเกต", className: "bg-amber-50 text-amber-800" },
  error: { label: "ต้องแก้", className: "bg-rose-50 text-rose-800" },
  duplicate: { label: "ซ้ำ", className: "bg-violet-50 text-violet-800" },
  imported: { label: "นำเข้าแล้ว", className: "bg-slate-100 text-slate-600" },
  pending: { label: "ยังไม่ตรวจ", className: "bg-slate-100 text-slate-500" }
};

const FLIGHT: Record<string, { label: string; className: string }> = {
  verified: { label: "ยืนยันแล้ว", className: "text-emerald-700" },
  multiple_matches: { label: "หลายเที่ยว", className: "text-amber-700" },
  route_mismatch: { label: "เส้นทางไม่ตรง", className: "text-amber-700" },
  not_found: { label: "ไม่พบ", className: "text-rose-700" },
  unchecked: { label: "ยังไม่ได้ตรวจ", className: "text-slate-500" }
};

type Filter = "all" | "attention" | RowStatus;

function localTime(iso?: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function ImportBatchView({ projectId, projectCode, batch, rows }: { projectId: string; projectCode: string; batch: ImportBatch; rows: ImportRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportActionState | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>(batch.meta.mapping ?? {});
  const closed = batch.status === "imported" || batch.status === "cancelled";

  const counts = useMemo(() => {
    const out: Record<RowStatus, number> = { valid: 0, warning: 0, error: 0, duplicate: 0, imported: 0, pending: 0 };
    for (const row of rows) out[row.status] += 1;
    return out;
  }, [rows]);
  const visible = rows.filter((row) =>
    filter === "all" ? true : filter === "attention" ? row.status === "error" || row.status === "duplicate" || row.status === "warning" : row.status === filter
  );
  const ready = counts.valid + (includeWarnings ? counts.warning : 0);
  const missing = missingRequiredColumns(mapping);
  const needsMapping = !closed && (counts.pending === rows.length || missing.length > 0);

  function run(action: () => Promise<ImportActionState>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-center gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`ทั้งหมด ${rows.length}`} />
        <Chip active={filter === "valid"} onClick={() => setFilter("valid")} label={`ผ่าน ${counts.valid}`} tone="emerald" />
        <Chip active={filter === "warning"} onClick={() => setFilter("warning")} label={`มีข้อสังเกต ${counts.warning}`} tone="amber" />
        <Chip active={filter === "error"} onClick={() => setFilter("error")} label={`ต้องแก้ ${counts.error}`} tone="rose" />
        <Chip active={filter === "duplicate"} onClick={() => setFilter("duplicate")} label={`ซ้ำ ${counts.duplicate}`} tone="violet" />
        {counts.imported ? <Chip active={filter === "imported"} onClick={() => setFilter("imported")} label={`นำเข้าแล้ว ${counts.imported}`} /> : null}
        {batch.meta.truncated ? <span className="text-xs font-semibold text-amber-800">ไฟล์มีเกิน 500 แถว อ่านเฉพาะ 500 แถวแรก</span> : null}
      </section>

      {result ? (
        <p className={`rounded-xl px-3 py-2 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{result.message}</p>
      ) : null}

      {needsMapping ? (
        <section className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <div>
            <h2 className="font-semibold text-amber-950">จับคู่คอลัมน์ในไฟล์กับข้อมูลที่ระบบต้องการ</h2>
            <p className="text-xs text-amber-900">
              ไฟล์นี้ไม่ใช่แบบฟอร์มของเรา ระบบเดาให้แล้ว ตรวจและแก้ช่องที่ยังว่าง (* ต้องมี)
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {IMPORT_COLUMNS.map((column) => (
              <label key={column.field} className="grid gap-1 text-xs">
                <span className={`font-semibold ${column.required && !mapping[column.field] ? "text-rose-700" : "text-slate-700"}`}>
                  {column.th}
                  {column.required ? " *" : ""}
                </span>
                <select
                  value={mapping[column.field] ?? ""}
                  onChange={(event) => setMapping((current) => ({ ...current, [column.field]: event.target.value || undefined }))}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                >
                  <option value="">— ไม่มีในไฟล์ —</option>
                  {batch.meta.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={pending || missing.length > 0}
            onClick={() => run(() => saveAirportTransferImportMapping(projectId, batch.id, mapping))}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-cyan-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} บันทึกและตรวจ
          </button>
        </section>
      ) : null}

      {!closed && !needsMapping ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-1 text-sm">
            <p className="font-semibold">
              พร้อมนำเข้า {ready} แถว
              {counts.error + counts.duplicate ? <span className="font-normal text-slate-500"> · อีก {counts.error + counts.duplicate} แถวต้องแก้ — กด “แก้ไข / เติมข้อมูล” ที่แถวนั้น</span> : null}
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={includeWarnings} onChange={(event) => setIncludeWarnings(event.target.checked)} />
              รวมแถวที่มีข้อสังเกต ({counts.warning}) — เคสจะขึ้นสถานะ “รอตรวจสอบ”
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => recheckAirportTransferImport(projectId, batch.id))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> ตรวจอีกครั้ง
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm("ยกเลิกชุดนี้? เคสที่นำเข้าไปแล้วจะไม่ถูกลบ")) run(() => cancelAirportTransferImport(projectId, batch.id));
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 disabled:opacity-50"
            >
              ยกเลิกชุดนี้
            </button>
            <button
              type="button"
              disabled={pending || ready === 0 || batch.status !== "ready"}
              onClick={() => run(() => commitAirportTransferImport(projectId, batch.id, includeWarnings))}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} ยืนยันนำเข้า {ready} เคส
            </button>
          </div>
        </section>
      ) : null}

      {closed ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {batch.status === "imported" ? "นำเข้าครบแล้ว — ขั้นถัดไป: จัดรถและคนขับให้แต่ละเคส" : "ชุดนี้ถูกยกเลิก"} ·{" "}
          <Link href={`/projects/${projectCode}/airport-transfer/cases`} className="font-semibold text-cyan-800 underline">
            ไปที่ข้อมูลการเดินทาง
          </Link>
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">แถว</th>
              <th className="px-3 py-2">ผล</th>
              <th className="px-3 py-2">ขา · วันที่ · เที่ยวบิน</th>
              <th className="px-3 py-2">ผู้โดยสาร</th>
              <th className="px-3 py-2">โรงแรม / สถานที่</th>
              <th className="px-3 py-2">ตรวจเที่ยวบิน</th>
              <th className="px-3 py-2">ข้อความ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <RowLine
                key={row.id}
                row={row}
                projectCode={projectCode}
                fix={
                  !closed && row.status !== "imported"
                    ? { projectId, batchId: batch.id, mapping: batch.meta.mapping }
                    : null
                }
              />
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  ไม่มีแถวในกลุ่มนี้
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowLine({
  row,
  projectCode,
  fix
}: {
  row: ImportRow;
  projectCode: string;
  /** Present while the row can still be corrected on screen. */
  fix: { projectId: string; batchId: string; mapping: ColumnMapping } | null;
}) {
  const [editing, setEditing] = useState(false);
  const data = row.data;
  const status = STATUS[row.status];
  const flight = data?.flight;
  const flightLabel = flight ? FLIGHT[flight.status] ?? FLIGHT.unchecked : null;
  const leg = flight?.flight;
  const errorFields = new Set(row.messages.filter((m) => m.level === "error").map((m) => m.field).filter(Boolean) as ImportField[]);
  const bad = (field: ImportField) => (errorFields.has(field) ? "text-rose-700 font-semibold" : "");
  return (
    <>
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2 tabular-nums text-slate-500">{row.rowNumber}</td>
      <td className="px-3 py-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
          {row.status === "valid" ? <CheckCircle2 className="h-3 w-3" /> : row.status === "error" ? <CircleX className="h-3 w-3" /> : row.status === "duplicate" ? <Copy className="h-3 w-3" /> : row.status === "warning" ? <AlertTriangle className="h-3 w-3" /> : null}
          {status.label}
        </span>
        {row.caseId ? (
          <Link href={`/projects/${projectCode}/airport-transfer/cases/${row.caseId}`} className="mt-1 block text-xs font-semibold text-cyan-800 underline">
            เปิดเคส
          </Link>
        ) : fix ? (
          <button type="button" onClick={() => setEditing((current) => !current)} className="mt-1 block text-xs font-semibold text-cyan-800 underline">
            {editing ? "ปิด" : row.status === "valid" ? "แก้ไข" : "แก้ไข / เติมข้อมูล"}
          </button>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <span className={bad("direction")}>{data?.direction === "arrival" ? "ขาเข้า" : data?.direction === "departure" ? "ขาออก" : "—"}</span>
        {" · "}
        <span className={bad("travelDate")}>{data?.travelDate ?? "—"}</span>
        {" · "}
        <span className={`font-semibold ${bad("flightNumber")}`}>{data?.flightNumber ?? "—"}</span>
      </td>
      <td className="px-3 py-2">
        <span className={bad("passengerFirstName") || bad("passengerLastName")}>
          {[data?.passengerTitle, data?.passengerFirstName, data?.passengerLastName].filter(Boolean).join(" ") || "—"}
        </span>
        <span className="block text-xs text-slate-500">
          {data?.passengerCount ?? "?"} คน · {data?.luggageCount ?? 0} กระเป๋า{data?.fastTrack ? " · Fast Track" : ""}
        </span>
      </td>
      <td className={`px-3 py-2 ${bad("placeName")}`}>{data?.placeName ?? "—"}</td>
      <td className="px-3 py-2 text-xs">
        {flightLabel ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${flightLabel.className}`}>
            <Plane className="h-3 w-3" /> {flightLabel.label}
            {flight?.optionCount ? ` (${flight.optionCount})` : ""}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
        {leg ? (
          <span className="block text-slate-500">
            {leg.originAirport} {localTime(leg.scheduledDepartureAt)} → {leg.destinationAirport} {localTime(leg.scheduledArrivalAt)}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-xs">
        {row.messages.length ? (
          <ul className="grid gap-0.5">
            {row.messages.map((message, index) => (
              <li key={index} className={message.level === "error" ? "text-rose-700" : "text-amber-800"}>
                {message.text}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
    {editing && fix ? (
      <tr>
        <td colSpan={7} className="px-3 pb-3">
          <RowFixForm projectId={fix.projectId} batchId={fix.batchId} rowId={row.id} raw={row.raw} mapping={fix.mapping} onDone={() => setEditing(false)} />
        </td>
      </tr>
    ) : null}
    </>
  );
}

function Chip({ label, active, onClick, tone }: { label: string; active: boolean; onClick: () => void; tone?: "emerald" | "amber" | "rose" | "violet" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-800" : tone === "amber" ? "text-amber-800" : tone === "rose" ? "text-rose-800" : tone === "violet" ? "text-violet-800" : "text-slate-700";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass} ${active ? "border-cyan-700 bg-cyan-50" : "border-slate-200 bg-white"}`}
    >
      {label}
    </button>
  );
}
