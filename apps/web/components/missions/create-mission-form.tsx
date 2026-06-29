"use client";

import { useState } from "react";
import { createMissionAction } from "@/app/actions/missions";
import { createMissionSchema } from "@/lib/validation";

export function CreateMissionForm({ projectId = "10000000-0000-4000-8000-000000000003" }: { projectId?: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const parsed = createMissionSchema.safeParse({
      projectId,
      projectDayId: "10000000-0000-4000-8000-000000000004",
      missionCode: formData.get("missionCode"),
      missionName: formData.get("missionName"),
      missionType: formData.get("missionType"),
      priority: formData.get("priority"),
      plannedStartTime: formData.get("plannedStartTime") || null,
      plannedEndTime: formData.get("plannedEndTime") || null,
      serviceCommitment: formData.get("serviceCommitment") || null
    });

    if (!parsed.success) {
      setMessage("กรุณากรอกข้อมูลภารกิจที่จำเป็นให้ครบถ้วน");
      return;
    }

    const result = await createMissionAction(parsed.data);
    setMessage(result.success ? result.warning || "บันทึกภารกิจและเตรียม Timeline แล้ว" : result.error || "สร้างภารกิจไม่สำเร็จ");
  }

  return (
    <form action={handleSubmit} className="grid gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">สร้างภารกิจ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">ภารกิจคือกิจกรรมบริการ เช่น รับผู้โดยสาร ส่งผู้ร่วมงาน หรือรถรับรอง</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">รหัสภารกิจ<input className="rounded-md border border-slate-300 px-3 py-2.5" name="missionCode" placeholder="MIS-001" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">ชื่อภารกิจ<input className="rounded-md border border-slate-300 px-3 py-2.5" name="missionName" placeholder="รับผู้โดยสารจากสนามบินรอบเช้า" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">ประเภทภารกิจ<input className="rounded-md border border-slate-300 px-3 py-2.5" name="missionType" placeholder="รับจากสนามบิน" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ความสำคัญ
          <select className="rounded-md border border-slate-300 px-3 py-2.5" name="priority" defaultValue="normal">
            <option value="low">ต่ำ</option>
            <option value="normal">ปกติ</option>
            <option value="high">สูง</option>
            <option value="critical">วิกฤต</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">เวลาเริ่มต้น<input className="rounded-md border border-slate-300 px-3 py-2.5" name="plannedStartTime" type="datetime-local" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">เวลาสิ้นสุด<input className="rounded-md border border-slate-300 px-3 py-2.5" name="plannedEndTime" type="datetime-local" /></label>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        ข้อผูกพันด้านบริการ
        <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2.5" name="serviceCommitment" placeholder="เช่น ต้องถึงจุดรับก่อนเวลา 15 นาที และประสานงานกับผู้จัดงานก่อนปล่อยรถ" />
      </label>
      {message ? <p className="rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm" type="submit">
        บันทึกภารกิจ
      </button>
    </form>
  );
}
