"use client";

import { useState, useTransition } from "react";
import { archivePilotSmokeTestDataAction } from "@/app/actions/data-quality";

export function PilotCleanupAction() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function archivePilotData() {
    setMessage(null);
    startTransition(async () => {
      const result = await archivePilotSmokeTestDataAction();
      if (!result.success) {
        setMessage(result.error || "เก็บชุดทดสอบไม่สำเร็จ");
        return;
      }
      const count = result.data?.archivedProjectCount ?? 0;
      setMessage(count > 0 ? `เก็บชุดทดสอบเก่าแล้ว ${count} โครงการ` : result.warning || "ไม่พบชุดทดสอบที่ต้องเก็บ");
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">เก็บชุดทดสอบเก่า</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            ใช้เมื่อข้อมูลทดสอบเก่ารบกวนการทดสอบจริง ระบบจะปิด QR, ปิด session GPS และตั้งสถานะชุดทดสอบเป็น archived โดยไม่ลบข้อมูล
          </p>
        </div>
        <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="button" onClick={archivePilotData}>
          {isPending ? "กำลังเก็บข้อมูล..." : "เก็บชุดทดสอบเก่า"}
        </button>
      </div>
      {message ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800">{message}</p> : null}
    </div>
  );
}
