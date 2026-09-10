"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProjectDetailsAction } from "@/app/actions/projects";
import { DateRangeFields } from "@/components/ui/datetime-field";

/**
 * Everything about the project that was fixed at creation and shouldn't have
 * been. Settings could only rename it, so an event that moved by a week meant
 * making a second project and abandoning the first.
 *
 * No floor on the dates here, unlike every other date field in the app: a
 * project already under way legitimately starts in the past, and refusing that
 * would make an existing project uneditable.
 */
export function ProjectDetailsForm({
  projectId,
  projectName,
  projectCode,
  startDate,
  endDate,
  timezone
}: {
  projectId: string;
  projectName: string;
  projectCode: string;
  startDate: string;
  endDate: string;
  timezone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(projectName);
  const [code, setCode] = useState(projectCode);
  const [start, setStart] = useState(startDate?.slice(0, 10) ?? "");
  const [end, setEnd] = useState(endDate?.slice(0, 10) ?? "");
  const [zone, setZone] = useState(timezone || "Asia/Bangkok");
  const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    name.trim() !== projectName.trim() ||
    code.trim() !== projectCode.trim() ||
    start !== (startDate?.slice(0, 10) ?? "") ||
    end !== (endDate?.slice(0, 10) ?? "") ||
    zone !== (timezone || "Asia/Bangkok");

  function save() {
    if (!dirty) return;
    setMsg(null);
    startTransition(async () => {
      const result = await updateProjectDetailsAction({
        projectId,
        projectName: name,
        projectCode: code,
        startDate: start,
        endDate: end,
        timezone: zone
      });
      if (result.success) {
        setMsg({ tone: result.warning ? "warn" : "ok", text: result.warning || "บันทึกข้อมูลโครงการแล้ว" });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error || "บันทึกไม่สำเร็จ" });
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label sm:col-span-2">
          ชื่อโครงการ
          <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field-label sm:col-span-2">
          รหัสโครงการ
          <input className="field-input font-mono" value={code} onChange={(event) => setCode(event.target.value)} />
          <span className="mt-1 text-xs text-slate-500">ใช้อ้างอิงในรายงานและใช้ยืนยันตอนลบโครงการ</span>
        </label>
      </div>

      <DateRangeFields
        legend="ช่วงเวลาโครงการ"
        startLabel="วันเริ่มงาน"
        endLabel="วันสิ้นสุดงาน"
        startName="startDate"
        endName="endDate"
        start={start}
        end={end}
        onStart={setStart}
        onEnd={setEnd}
        required
      />

      <label className="field-label">
        เขตเวลา
        <select className="field-input" value={zone} onChange={(event) => setZone(event.target.value)}>
          <option value="Asia/Bangkok">Asia/Bangkok (ไทย)</option>
          <option value="Asia/Singapore">Asia/Singapore</option>
          <option value="Asia/Tokyo">Asia/Tokyo</option>
          <option value="UTC">UTC</option>
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="rounded-xl bg-operation px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูลโครงการ"}
        </button>
        {msg ? (
          <span
            className={`text-xs font-semibold ${
              msg.tone === "ok" ? "text-emerald-700" : msg.tone === "warn" ? "text-amber-700" : "text-rose-700"
            }`}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
