"use client";

import { useState } from "react";
import { createDriverAction } from "@/app/actions/resources";
import { createDriverSchema } from "@/lib/validation";

export function CreateDriverForm() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const parsed = createDriverSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      licenseType: formData.get("licenseType") || null,
      languages: [],
      metadata: {
        projectId: "10000000-0000-4000-8000-000000000003"
      }
    });

    if (!parsed.success) {
      setMessage("กรุณากรอกข้อมูลคนขับที่จำเป็นให้ครบถ้วน");
      return;
    }

    const result = await createDriverAction(parsed.data);
    setMessage(result.success ? result.warning || "บันทึกข้อมูลคนขับและเตรียม Timeline แล้ว" : result.error || "สร้างข้อมูลคนขับไม่สำเร็จ");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">เพิ่มคนขับ</h2>
      <input className="rounded-md border border-slate-300 px-3 py-2" name="fullName" placeholder="ชื่อ-นามสกุล" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="phone" placeholder="เบอร์โทรศัพท์" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="licenseType" placeholder="ประเภทใบขับขี่" />
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">บันทึกคนขับ</button>
    </form>
  );
}
