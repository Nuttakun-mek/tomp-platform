"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setAirportTransferImportOps } from "@/app/airport-transfer/import-actions";
import type { RowOps, UnitOption } from "@/lib/airport-transfer/import/ops";

const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-[13px]";
const label = "grid gap-1 text-[11px] font-semibold text-slate-600";

/** "2026-10-02T15:45" in Bangkok time, for a datetime-local input. */
export function toBangkokLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/**
 * The control room's part of one row before it becomes a case: pickup time,
 * where to meet at the airport, and which unit goes — one of the project's
 * Call Signs (its driver and vehicle come with it), or a vehicle typed in.
 * Nothing here is required.
 */
export function RowOpsForm({
  projectId,
  batchId,
  rowId,
  ops,
  suggestedPickupAt,
  airportEnd,
  units,
  onDone
}: {
  projectId: string;
  batchId: string;
  rowId: string;
  ops: RowOps;
  suggestedPickupAt: string | null;
  /** "รับที่สนามบิน" or "ส่งที่สนามบิน" — which end the meeting point is for. */
  airportEnd: string;
  units: UnitOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pickup, setPickup] = useState(toBangkokLocal(ops.pickupAt ?? null));
  const [meetingPoint, setMeetingPoint] = useState(ops.meetingPoint ?? "");
  const [mode, setMode] = useState<"unit" | "manual">(ops.callSignId || !(ops.vehiclePlate || ops.driverName) ? "unit" : "manual");
  const [callSignId, setCallSignId] = useState(ops.callSignId ?? "");
  const [manual, setManual] = useState({ vehicleType: ops.vehicleType ?? "", vehiclePlate: ops.vehiclePlate ?? "", driverName: ops.driverName ?? "", driverPhone: ops.driverPhone ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const patch: RowOps = {
      pickupAt: pickup ? new Date(`${pickup}:00+07:00`).toISOString() : null,
      meetingPoint: meetingPoint.trim() || null,
      ...(mode === "unit"
        ? { callSignId: callSignId || null, vehicleType: null, vehiclePlate: null, driverName: null, driverPhone: null }
        : {
            callSignId: null,
            vehicleType: manual.vehicleType.trim() || null,
            vehiclePlate: manual.vehiclePlate.trim() || null,
            driverName: manual.driverName.trim() || null,
            driverPhone: manual.driverPhone.trim() || null
          })
    };
    startTransition(async () => {
      const result = await setAirportTransferImportOps(projectId, batchId, [rowId], patch);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2.5 rounded-xl border border-teal-200 bg-teal-50/40 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className={label}>
          เวลารับ
          <input type="datetime-local" className={input} value={pickup} onChange={(event) => setPickup(event.target.value)} />
          <span className="font-normal text-slate-500">
            {suggestedPickupAt ? `ว่างไว้ = ตามที่แนะนำ ${toBangkokLocal(suggestedPickupAt).replace("T", " ")}` : "ยังไม่มีเวลาเที่ยวบิน"}
          </span>
        </label>
        <label className={`${label} lg:col-span-2`}>
          จุดนัดพบ ({airportEnd})
          <input className={input} value={meetingPoint} onChange={(event) => setMeetingPoint(event.target.value)} placeholder="เช่น ประตู 3 ชั้น 2 ป้าย TOMP" />
        </label>
      </div>

      <div className="grid gap-2">
        <div role="radiogroup" aria-label="รถและคนขับ" className="inline-flex w-fit rounded-full border border-slate-300 bg-white p-0.5 text-[12px] font-semibold">
          {(
            [
              ["unit", `Call Sign ของโครงการ${units.length ? ` (${units.length})` : ""}`],
              ["manual", "รถนอกโครงการ (พิมพ์เอง)"]
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-full px-3 py-1 ${mode === value ? "bg-operation text-white" : "text-slate-600"}`}
            >
              {text}
            </button>
          ))}
        </div>
        {mode === "unit" ? (
          units.length ? (
            <select className={`${input} max-w-xl`} value={callSignId} onChange={(event) => setCallSignId(event.target.value)} aria-label="Call Sign">
              <option value="">— ยังไม่จัดรถ —</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {[unit.label, unit.plate, unit.vehicleType, unit.capacity ? `${unit.capacity} ที่นั่ง` : null, unit.driverName, unit.driverPhone].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[12px] text-slate-500">โครงการนี้ยังไม่มี Call Sign — เลือก “รถนอกโครงการ” หรือเพิ่มหน่วยรถที่ Ground Transfer › ทรัพยากร</p>
          )
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["vehicleType", "ประเภทรถ", "เช่น รถตู้"],
                ["vehiclePlate", "ทะเบียน", "เช่น 1กข 1234"],
                ["driverName", "ชื่อคนขับ", ""],
                ["driverPhone", "เบอร์คนขับ", "08x-xxx-xxxx"]
              ] as const
            ).map(([key, text, placeholder]) => (
              <label key={key} className={label}>
                {text}
                <input className={input} value={manual[key]} placeholder={placeholder} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} />
              </label>
            ))}
          </div>
        )}
      </div>

      {error ? <p className="text-[12px] font-semibold text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-operation px-3 text-[12px] font-semibold text-white disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} บันทึก
        </button>
        <button type="button" onClick={onDone} disabled={pending} className="min-h-8 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-600">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
