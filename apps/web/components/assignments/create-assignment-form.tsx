"use client";

import { useState, useTransition } from "react";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createAssignmentAction } from "@/app/actions/assignments";
import { createAssignmentSchema } from "@/lib/validation";

interface CreateAssignmentFormProps {
  projectId: string;
  missions: Mission[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}

export function CreateAssignmentForm({ projectId, missions, callSigns, drivers, vehicles }: CreateAssignmentFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canCreate = missions.length > 0 && callSigns.length > 0;

  function handleSubmit(formData: FormData) {
    setMessage(null);
    const parsed = createAssignmentSchema.safeParse({
      projectId,
      missionId: formData.get("missionId"),
      callSignId: formData.get("callSignId"),
      driverId: formData.get("driverId") || null,
      vehicleId: formData.get("vehicleId") || null,
      startTime: formData.get("startTime") || null,
      endTime: formData.get("endTime") || null,
      metadata: {
        pickupLocation: "จุดรับผู้โดยสาร",
        dropoffLocation: "จุดส่งปลายทาง"
      }
    });

    if (!parsed.success) {
      setMessage("กรุณาเลือกภารกิจและ Call Sign ให้ครบถ้วน");
      return;
    }

    startTransition(async () => {
      const result = await createAssignmentAction(parsed.data);
      if (!result.success) {
        setMessage(result.error || "สร้าง Assignment ไม่สำเร็จ");
        return;
      }
      setMessage("สร้าง Assignment สำเร็จ กำลังโหลดข้อมูลใหม่");
      window.location.reload();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">จัดสรรงาน</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">เลือก Mission, Call Sign, คนขับ และรถจากข้อมูลจริงในระบบ</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เลือกภารกิจ
          <select className="rounded-md border border-slate-300 bg-white px-3 py-2.5" name="missionId" required>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.missionCode} | {mission.missionName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Call Sign
          <select className="rounded-md border border-slate-300 bg-white px-3 py-2.5" name="callSignId" required>
            {callSigns.map((callSign) => (
              <option key={callSign.id} value={callSign.id}>
                {callSign.callSign}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เลือกคนขับ
          <select className="rounded-md border border-slate-300 bg-white px-3 py-2.5" name="driverId" defaultValue="">
            <option value="">ยังไม่ระบุคนขับ</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName} | {driver.phone}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เลือกรถ
          <select className="rounded-md border border-slate-300 bg-white px-3 py-2.5" name="vehicleId" defaultValue="">
            <option value="">ยังไม่ระบุรถ</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plateNumber} | {vehicle.vehicleType}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เวลาเริ่ม
          <input className="rounded-md border border-slate-300 px-3 py-2.5" name="startTime" type="datetime-local" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เวลาสิ้นสุด
          <input className="rounded-md border border-slate-300 px-3 py-2.5" name="endTime" type="datetime-local" />
        </label>
      </div>

      {!canCreate ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          ต้องมี Mission และ Call Sign ก่อนจึงจะสร้าง Assignment ได้ ใช้หน้า “ทดสอบ GPS สด” เพื่อสร้างชุดทดสอบครบชุดได้ทันที
        </p>
      ) : null}
      {message ? <p className="rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={!canCreate || isPending} type="submit">
        {isPending ? "กำลังสร้าง..." : "สร้าง Assignment"}
      </button>
    </form>
  );
}
