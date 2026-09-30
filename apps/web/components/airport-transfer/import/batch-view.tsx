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
  setAirportTransferImportOps,
  type ImportActionState
} from "@/app/airport-transfer/import-actions";
import type { ImportBatch, ImportRow, RowStatus } from "@/lib/airport-transfer/import/batch";
import { IMPORT_COLUMNS, type ImportField } from "@/lib/airport-transfer/import/columns";
import { missingRequiredColumns, type ColumnMapping } from "@/lib/airport-transfer/import/normalize";
import { suggestedPickupAt } from "@/lib/airport-transfer/import/flight-match";
import { opsWarnings, type UnitOption } from "@/lib/airport-transfer/import/ops";
import { RowFixForm } from "./row-fix-form";
import { RowOpsForm, toBangkokLocal } from "./row-ops-form";

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

export function ImportBatchView({
  projectId,
  projectCode,
  batch,
  rows,
  units = []
}: {
  projectId: string;
  projectCode: string;
  batch: ImportBatch;
  rows: ImportRow[];
  /** The project's Ground Transfer units, to send on these trips. */
  units?: UnitOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportActionState | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // Rows that passed start ticked; rows with a note are ticked by hand.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.filter((row) => row.status === "valid").map((row) => row.id)));
  const [bulkUnit, setBulkUnit] = useState("");
  const [bulkMeeting, setBulkMeeting] = useState("");
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
  const selectable = (row: ImportRow) => row.status === "valid" || row.status === "warning";
  const picked = rows.filter((row) => selected.has(row.id) && selectable(row));
  const ready = picked.length;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectWhere = (test: (row: ImportRow) => boolean) => setSelected(new Set(rows.filter((row) => selectable(row) && test(row)).map((row) => row.id)));
  const warnings = useMemo(
    () =>
      opsWarnings(
        rows
          .filter((row) => row.data && row.status !== "imported")
          .map((row) => ({ id: row.id, direction: row.data!.direction, passengerCount: row.data!.passengerCount, flight: row.data!.flight?.flight ?? null, ops: row.data!.ops ?? null })),
        units
      ),
    [rows, units]
  );
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
              เลือกไว้ {ready} แถว
              {counts.error + counts.duplicate ? <span className="font-normal text-slate-500"> · อีก {counts.error + counts.duplicate} แถวต้องแก้ก่อน — กด “แก้ไข / เติมข้อมูล” ที่แถวนั้น</span> : null}
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-cyan-800">
              <button type="button" onClick={() => selectWhere(() => true)} className="underline">เลือกทั้งหมด</button>
              <button type="button" onClick={() => selectWhere((row) => row.status === "valid")} className="underline">เฉพาะที่ผ่าน</button>
              <button type="button" onClick={() => setSelected(new Set())} className="underline">ไม่เลือก</button>
              <span className="font-normal text-slate-500">· แถวที่มีข้อสังเกตจะขึ้นสถานะ “รอตรวจสอบ”</span>
            </div>
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
              onClick={() => run(() => commitAirportTransferImport(projectId, batch.id, picked.map((row) => row.id)))}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} นำเข้า {ready} เคสที่เลือก
            </button>
          </div>
        </section>
      ) : null}

      {!closed && !needsMapping && picked.length ? (
        <section className="flex flex-wrap items-end gap-2 rounded-2xl border border-teal-200 bg-teal-50/40 p-3">
          <p className="w-full text-xs font-semibold text-teal-900">กำหนดให้ {picked.length} แถวที่เลือกพร้อมกัน</p>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Call Sign
            <select value={bulkUnit} onChange={(event) => setBulkUnit(event.target.value)} className="h-9 min-w-[16rem] rounded-lg border border-slate-300 bg-white px-2 text-[13px]">
              <option value="">— ไม่เปลี่ยน —</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {[unit.label, unit.plate, unit.driverName].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            จุดนัดพบที่สนามบิน
            <input value={bulkMeeting} onChange={(event) => setBulkMeeting(event.target.value)} placeholder="เช่น ประตู 3 ชั้น 2" className="h-9 min-w-[14rem] rounded-lg border border-slate-300 bg-white px-2 text-[13px]" />
          </label>
          <button
            type="button"
            disabled={pending || (!bulkUnit && !bulkMeeting.trim())}
            onClick={() =>
              run(async () => {
                const outcome = await setAirportTransferImportOps(projectId, batch.id, picked.map((row) => row.id), {
                  ...(bulkUnit ? { callSignId: bulkUnit } : {}),
                  ...(bulkMeeting.trim() ? { meetingPoint: bulkMeeting.trim() } : {})
                });
                if (outcome.ok) {
                  setBulkUnit("");
                  setBulkMeeting("");
                }
                return outcome;
              })
            }
            className="h-9 rounded-lg bg-operation px-3 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            ใช้กับแถวที่เลือก
          </button>
        </section>
      ) : null}

      {closed ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {batch.status === "imported" ? "นำเข้าครบแล้ว — เคสที่ยังไม่จัดรถรออยู่ใน “ข้อมูลการเดินทาง”" : "ชุดนี้ถูกยกเลิก"} ·{" "}
          <Link href={`/projects/${projectCode}/airport-transfer/cases`} className="font-semibold text-cyan-800 underline">
            ไปที่ข้อมูลการเดินทาง
          </Link>
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2">
                {!closed ? (
                  <input
                    type="checkbox"
                    aria-label="เลือกทุกแถวที่นำเข้าได้"
                    checked={picked.length > 0 && picked.length === rows.filter(selectable).length}
                    onChange={(event) => (event.target.checked ? selectWhere(() => true) : setSelected(new Set()))}
                  />
                ) : null}
              </th>
              <th className="px-3 py-2">แถว</th>
              <th className="px-3 py-2">ผล</th>
              <th className="px-3 py-2">ขา · วันที่ · เที่ยวบิน</th>
              <th className="px-3 py-2">ผู้โดยสาร</th>
              <th className="px-3 py-2">โรงแรม / สถานที่</th>
              <th className="px-3 py-2">ตรวจเที่ยวบิน</th>
              <th className="px-3 py-2">ปฏิบัติการ</th>
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
                    ? { projectId, batchId: batch.id, mapping: batch.meta.mapping, units }
                    : null
                }
                selectable={!closed && selectable(row)}
                selected={selected.has(row.id)}
                onToggle={() => toggle(row.id)}
                units={units}
                opsWarnings={warnings.get(row.id) ?? []}
              />
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
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
  fix,
  selectable,
  selected,
  onToggle,
  units,
  opsWarnings: warningsForRow
}: {
  row: ImportRow;
  projectCode: string;
  /** Present while the row can still be corrected on screen. */
  fix: { projectId: string; batchId: string; mapping: ColumnMapping; units: UnitOption[] } | null;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  units: UnitOption[];
  opsWarnings: string[];
}) {
  const [editing, setEditing] = useState<"fix" | "ops" | null>(null);
  const ops = row.data?.ops ?? {};
  const unit = ops.callSignId ? units.find((item) => item.id === ops.callSignId) : undefined;
  const suggested = row.data?.direction && row.data.flight?.flight ? suggestedPickupAt(row.data.direction, row.data.flight.flight) : null;
  const pickupAt = ops.pickupAt ?? suggested;
  const data = row.data;
  const status = STATUS[row.status];
  const flight = data?.flight;
  const flightLabel = flight ? FLIGHT[flight.status] ?? FLIGHT.unchecked : null;
  const leg = flight?.flight;
  const errorFields = new Set(row.messages.filter((m) => m.level === "error").map((m) => m.field).filter(Boolean) as ImportField[]);
  const bad = (field: ImportField) => (errorFields.has(field) ? "text-rose-700 font-semibold" : "");
  return (
    <>
    <tr className={`border-t border-slate-100 align-top ${selected ? "bg-teal-50/30" : ""}`}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected && selectable} disabled={!selectable} onChange={onToggle} aria-label={`เลือกแถว ${row.rowNumber}`} />
      </td>
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
          <button type="button" onClick={() => setEditing((current) => (current === "fix" ? null : "fix"))} className="mt-1 block text-xs font-semibold text-cyan-800 underline">
            {editing === "fix" ? "ปิด" : row.status === "valid" ? "แก้ไข" : "แก้ไข / เติมข้อมูล"}
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
        {row.status === "imported" ? (
          <span className="text-slate-400">—</span>
        ) : (
          <div className="grid gap-0.5">
            <span className="tabular-nums text-slate-700">
              รับ {pickupAt ? toBangkokLocal(pickupAt).slice(5).replace("T", " ") : "—"}
              {!ops.pickupAt && suggested ? <span className="ml-1 text-slate-400">(แนะนำ)</span> : null}
            </span>
            <span className={unit || ops.vehiclePlate ? "font-semibold text-ink" : "text-amber-700"}>
              {unit ? `${unit.label}${unit.plate ? ` · ${unit.plate}` : ""}` : ops.vehiclePlate || ops.driverName ? [ops.vehiclePlate, ops.driverName].filter(Boolean).join(" · ") : "ยังไม่จัดรถ"}
            </span>
            {ops.meetingPoint ? <span className="text-slate-500">นัดพบ: {ops.meetingPoint}</span> : null}
            {warningsForRow.map((text) => (
              <span key={text} className="text-amber-800">{text}</span>
            ))}
            {fix ? (
              <button type="button" onClick={() => setEditing((current) => (current === "ops" ? null : "ops"))} className="w-fit text-xs font-semibold text-operation underline">
                {editing === "ops" ? "ปิด" : "จัดรถ / เวลา"}
              </button>
            ) : null}
          </div>
        )}
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
        <td colSpan={9} className="px-3 pb-3">
          {editing === "fix" ? (
            <RowFixForm projectId={fix.projectId} batchId={fix.batchId} rowId={row.id} raw={row.raw} mapping={fix.mapping} onDone={() => setEditing(null)} />
          ) : (
            <RowOpsForm
              projectId={fix.projectId}
              batchId={fix.batchId}
              rowId={row.id}
              ops={ops}
              suggestedPickupAt={suggested}
              airportEnd={row.data?.direction === "departure" ? "ส่งที่สนามบิน" : "รับที่สนามบิน"}
              units={fix.units}
              onDone={() => setEditing(null)}
            />
          )}
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
