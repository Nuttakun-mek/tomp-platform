"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Loader2, X } from "lucide-react";
import { updateMissionDutyHoursAction } from "@/app/actions/missions";
import type { DutyHours } from "@/lib/domain/duty-hours";

/**
 * One day's clock-in/out on a unit card, editable in place. Changes the main
 * job's hours for that day, so every unit on the same main job follows.
 */
export function DutyHoursChip({ projectId, missionId, date, hours }: { projectId: string; missionId: string; date: string; hours: DutyHours | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(hours?.start ?? "07:00");
  const [end, setEnd] = useState(hours?.end ?? "17:00");
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="แก้เวลาเข้า-ออกงานของวันนี้"
        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${hours ? "bg-slate-100 text-ink-soft hover:bg-teal-50 hover:text-operation" : "bg-amber-50 text-amber-800"}`}
      >
        <Clock3 className="h-3 w-3" />
        {hours ? `${hours.start}–${hours.end}` : "ตั้งเวลาเข้า-ออก"}
      </button>
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateMissionDutyHoursAction({ projectId, missionId, date, start, end, applyToFollowing: following });
      if (!result.success) {
        setError(result.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[10px]">
      <input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="h-6 rounded border border-slate-300 px-1" aria-label="เข้างาน" />
      <span>–</span>
      <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="h-6 rounded border border-slate-300 px-1" aria-label="ออกงาน" />
      <button type="button" onClick={save} disabled={pending} aria-label="บันทึก" className="grid h-6 w-6 place-items-center rounded-full bg-operation text-white disabled:opacity-50">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button type="button" onClick={() => setEditing(false)} aria-label="ยกเลิก" className="grid h-6 w-6 place-items-center rounded-full border border-slate-300 text-ink-soft">
        <X className="h-3 w-3" />
      </button>
      <label className="flex w-full items-center gap-1 text-ink-soft">
        <input type="checkbox" checked={following} onChange={(event) => setFollowing(event.target.checked)} />
        ใช้กับวันนี้และทุกวันถัดไปของภารกิจหลัก
      </label>
      {error ? <span className="w-full text-rose-700">{error}</span> : null}
    </span>
  );
}
