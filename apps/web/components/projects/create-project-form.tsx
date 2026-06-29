"use client";

import { useState } from "react";
import { createProjectAction } from "@/app/actions/projects";
import { createProjectSchema } from "@/lib/validation";

export function CreateProjectForm() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const parsed = createProjectSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      projectCode: formData.get("projectCode"),
      projectName: formData.get("projectName"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      timezone: formData.get("timezone"),
      serviceLevel: formData.get("serviceLevel")
    });

    if (!parsed.success) {
      setMessage("กรุณากรอกข้อมูลโครงการที่จำเป็นให้ครบถ้วน");
      return;
    }

    const result = await createProjectAction(parsed.data);
    setMessage(result.success ? result.warning || "บันทึกโครงการและเตรียม Timeline แล้ว" : result.error || "สร้างโครงการไม่สำเร็จ");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-ink">สร้างโครงการ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">บันทึกโครงการผ่าน server action เมื่อเชื่อมต่อ Supabase แล้ว และเตรียมเหตุการณ์ใน Timeline</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          รหัสโครงการ
          <input className="rounded-md border border-slate-300 px-3 py-2" name="projectCode" placeholder="TOMP-2026-001" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ชื่อโครงการ
          <input className="rounded-md border border-slate-300 px-3 py-2" name="projectName" placeholder="งานรับส่งผู้ร่วมประชุม" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          วันที่เริ่มต้น
          <input className="rounded-md border border-slate-300 px-3 py-2" name="startDate" type="date" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          วันที่สิ้นสุด
          <input className="rounded-md border border-slate-300 px-3 py-2" name="endDate" type="date" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เขตเวลา
          <input className="rounded-md border border-slate-300 px-3 py-2" name="timezone" defaultValue="Asia/Bangkok" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ระดับบริการ
          <select className="rounded-md border border-slate-300 px-3 py-2" name="serviceLevel" defaultValue="standard">
            <option value="standard">มาตรฐาน</option>
            <option value="premium">พรีเมียม</option>
            <option value="vip">VIP</option>
          </select>
        </label>
      </div>
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
        บันทึกโครงการ
      </button>
    </form>
  );
}
