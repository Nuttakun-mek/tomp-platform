"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine, X } from "lucide-react";
import { adjustDutyDayAction } from "@/app/actions/missions";
import { toBangkokLocal } from "@/components/airport-transfer/import/row-ops-form";

const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-[13px]";
const clock = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";
const toIso = (local: string) => (local ? new Date(`${local}:00+07:00`).toISOString() : null);

/**
 * The control room's correction of one unit's day on the day-close page: when
 * overtime starts, and the real clock-out (a driver who forgot to press it, or
 * pressed it late). Each needs a reason; "คืนค่าตามระบบ" removes both. The
 * driver's own clock-in/out stay as they were — this is kept beside them.
 */
export function DutyAdjustDialog({
  projectId,
  callSignId,
  date,
  label,
  computedEnd,
  scheduledEnd,
  dutyEnd,
  recordedClockOut,
  clockOut,
  adjusted,
  reason: currentReason
}: {
  projectId: string;
  callSignId: string;
  date: string;
  label: string;
  /** The end the rules give, before any correction. */
  computedEnd: string;
  scheduledEnd: string;
  dutyEnd: string;
  recordedClockOut: string | null;
  clockOut: string | null;
  adjusted: boolean;
  reason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [end, setEnd] = useState(toBangkokLocal(dutyEnd));
  const [out, setOut] = useState(toBangkokLocal(clockOut));
  const [reason, setReason] = useState(currentReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lateNote = computedEnd !== scheduledEnd ? ` (กำหนด ${clock(scheduledEnd)} · เข้าช้า เลื่อนให้ครบชั่วโมง)` : "";

  function submit(clear: boolean) {
    setError(null);
    // Only what differs from the system's own value is a correction.
    const endAt = clear || end === toBangkokLocal(computedEnd) ? null : toIso(end);
    const clockOutAt = clear || out === toBangkokLocal(recordedClockOut) ? null : toIso(out);
    if (!clear && !endAt && !clockOutAt && !adjusted) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await adjustDutyDayAction({ projectId, callSignId, date, endAt, clockOutAt, reason: clear ? "คืนค่าตามระบบ" : reason });
      if (!result.success) {
        setError(result.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-operation hover:text-operation"
      >
        <PencilLine className="h-3 w-3" /> แก้เวลา
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={`แก้เวลา ${label}`}>
          <div className="grid w-full max-w-md gap-3 rounded-panel bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">แก้เวลาเลิกงาน</p>
                <p className="text-base font-bold text-ink">{label}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="ปิด">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="grid gap-1 text-[12px] font-semibold text-slate-700">
              เวลาเลิกงาน — เริ่มคิด OT หลังเวลานี้
              <input type="datetime-local" className={input} value={end} onChange={(event) => setEnd(event.target.value)} />
              <span className="font-normal text-slate-500">ตามระบบ {clock(computedEnd)}{lateNote}</span>
            </label>

            <label className="grid gap-1 text-[12px] font-semibold text-slate-700">
              เวลาออกงานจริง
              <input type="datetime-local" className={input} value={out} onChange={(event) => setOut(event.target.value)} />
              <span className="font-normal text-slate-500">
                {recordedClockOut ? `คนขับกดสิ้นสุดปฏิบัติงาน ${clock(recordedClockOut)}` : "คนขับไม่ได้กดสิ้นสุดปฏิบัติงาน"}
              </span>
            </label>

            <label className="grid gap-1 text-[12px] font-semibold text-slate-700">
              <span>
                เหตุผล <span className="text-rose-600">*</span>
              </span>
              <input className={input} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เช่น คนขับลืมกดออกงาน ยืนยันกับคนขับแล้ว" />
            </label>

            {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">{error}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(false)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-operation px-3.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} บันทึก
              </button>
              {adjusted ? (
                <button type="button" disabled={pending} onClick={() => submit(true)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-600">
                  คืนค่าตามระบบ
                </button>
              ) : null}
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="min-h-9 px-2 text-[13px] font-semibold text-slate-500">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
