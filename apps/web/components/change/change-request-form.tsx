"use client";

import { useState } from "react";
import { createChangeRequestAction } from "@/app/actions/change-requests";

export function ChangeRequestForm({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await createChangeRequestAction({
      projectId,
      objectType: formData.get("objectType"),
      severity: formData.get("severity"),
      reason: formData.get("reason"),
      impactSummary: formData.get("impactSummary") || null
    });

    setMessage(result.success ? result.warning || "สร้างคำขอเปลี่ยนแปลงแล้ว" : result.error || "สร้างคำขอเปลี่ยนแปลงไม่สำเร็จ");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">คำขอเปลี่ยนแปลง</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <input className="rounded-md border border-slate-300 px-3 py-2" name="objectType" placeholder="assignment" defaultValue="assignment" />
        <select className="rounded-md border border-slate-300 px-3 py-2" name="severity" defaultValue="medium">
          <option value="low">ต่ำ</option>
          <option value="medium">ปานกลาง</option>
          <option value="high">สูง</option>
          <option value="critical">วิกฤต</option>
        </select>
      </div>
      <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2" name="reason" placeholder="เหตุผลที่ต้องเปลี่ยนหลังประกาศใช้แผน" />
      <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2" name="impactSummary" placeholder="สรุปผลกระทบต่อปฏิบัติการ" />
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
        สร้างคำขอเปลี่ยนแปลง
      </button>
    </form>
  );
}
