"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createChangeRequestAction } from "@/app/actions/change-requests";

export function ChangeRequestForm({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await createChangeRequestAction({
        projectId,
        objectType: formData.get("objectType"),
        severity: formData.get("severity"),
        reason: formData.get("reason"),
        impactSummary: formData.get("impactSummary") || null
      });
      setMessage(result.success ? result.warning || "บันทึกคำขอเปลี่ยนแปลงแล้ว" : result.error || "บันทึกคำขอเปลี่ยนแปลงไม่สำเร็จ");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="enterprise-card grid gap-4 p-4">
      <div>
        <p className="section-label">Change Control</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">คำขอเปลี่ยนแปลงแผน</h2>
        <p className="mt-1 text-xs leading-5 text-ink-faint">ใช้บันทึกการเปลี่ยนแปลงหลังประกาศใช้แผน เพื่อให้ศูนย์ควบคุมตรวจผลกระทบได้ครบถ้วน</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field-label">
          ประเภทข้อมูลที่ต้องเปลี่ยน
          <input className="field-input" name="objectType" placeholder="เช่น งานที่จัดสรร" defaultValue="assignment" />
        </label>
        <label className="field-label">
          ระดับผลกระทบ
          <select className="field-input" name="severity" defaultValue="medium">
          <option value="low">ต่ำ</option>
          <option value="medium">ปานกลาง</option>
          <option value="high">สูง</option>
          <option value="critical">วิกฤต</option>
          </select>
        </label>
      </div>
      <label className="field-label">
        เหตุผลการเปลี่ยนแปลง
        <textarea className="field-input min-h-24" name="reason" placeholder="ระบุเหตุผลที่ต้องเปลี่ยนแผนหลังประกาศใช้" />
      </label>
      <label className="field-label">
        ผลกระทบต่อการปฏิบัติการ
        <textarea className="field-input min-h-20" name="impactSummary" placeholder="สรุปผลกระทบต่อเวลา รถ คนขับ ผู้โดยสาร หรือผู้ประสานงาน" />
      </label>
      {message ? <p className="rounded-card bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-command bg-operation px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก" : "บันทึกคำขอเปลี่ยนแปลง"}
      </button>
    </form>
  );
}
