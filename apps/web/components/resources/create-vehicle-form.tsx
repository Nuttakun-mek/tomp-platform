"use client";

import { useState } from "react";
import { createVehicleAction } from "@/app/actions/resources";
import { createVehicleSchema } from "@/lib/validation";

export function CreateVehicleForm() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const parsed = createVehicleSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      plateNumber: formData.get("plateNumber"),
      vehicleType: formData.get("vehicleType"),
      capacity: formData.get("capacity"),
      metadata: {
        projectId: "10000000-0000-4000-8000-000000000003"
      }
    });

    if (!parsed.success) {
      setMessage("กรุณากรอกข้อมูลรถที่จำเป็นให้ครบถ้วน");
      return;
    }

    const result = await createVehicleAction(parsed.data);
    setMessage(result.success ? result.warning || "บันทึกข้อมูลรถและเตรียม Timeline แล้ว" : result.error || "สร้างข้อมูลรถไม่สำเร็จ");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">เพิ่มรถ</h2>
      <input className="rounded-md border border-slate-300 px-3 py-2" name="plateNumber" placeholder="ทะเบียนรถ" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="vehicleType" placeholder="ประเภทรถ" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="capacity" placeholder="จำนวนที่นั่ง" type="number" />
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">บันทึกรถ</button>
    </form>
  );
}
