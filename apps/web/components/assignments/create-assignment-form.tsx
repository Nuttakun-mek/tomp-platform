"use client";

import { useState } from "react";
import { createAssignmentAction } from "@/app/actions/assignments";
import { createAssignmentSchema } from "@/lib/validation";

export function CreateAssignmentForm({ projectId = "10000000-0000-4000-8000-000000000003" }: { projectId?: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const parsed = createAssignmentSchema.safeParse({
      projectId,
      missionId: "10000000-0000-4000-8000-000000000006",
      callSignId: "10000000-0000-4000-8000-000000000007",
      driverId: null,
      vehicleId: null,
      startTime: formData.get("startTime") || null,
      endTime: formData.get("endTime") || null
    });

    if (!parsed.success) {
      setMessage("กรุณาตรวจข้อมูล Assignment ให้ครบถ้วน");
      return;
    }

    const result = await createAssignmentAction(parsed.data);
    setMessage(result.success ? result.warning || "สร้าง Assignment และเตรียม Timeline แล้ว" : result.error || "สร้าง Assignment ไม่สำเร็จ");
  }

  return (
    <form action={handleSubmit} className="grid gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">จัดสรรงาน</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">เชื่อมภารกิจ Call Sign รถ คนขับ และช่วงเวลาปฏิบัติงานเข้าด้วยกัน</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input className="rounded-md border border-slate-300 px-3 py-2.5" placeholder="เลือกภารกิจ" />
        <input className="rounded-md border border-slate-300 px-3 py-2.5" placeholder="Call Sign" />
        <input className="rounded-md border border-slate-300 px-3 py-2.5" placeholder="เลือกคนขับ" />
        <input className="rounded-md border border-slate-300 px-3 py-2.5" placeholder="เลือกรถ" />
        <label className="grid gap-2 text-sm font-medium text-slate-700">เวลาเริ่ม<input className="rounded-md border border-slate-300 px-3 py-2.5" name="startTime" type="datetime-local" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">เวลาสิ้นสุด<input className="rounded-md border border-slate-300 px-3 py-2.5" name="endTime" type="datetime-local" /></label>
      </div>
      {message ? <p className="rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm" type="submit">
        สร้าง Assignment
      </button>
    </form>
  );
}
