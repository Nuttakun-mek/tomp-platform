"use client";

import { useState, useTransition } from "react";
import type { CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { createAssignmentAction } from "@/app/actions/assignments";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Tooltip } from "@/components/ui/tooltip";
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
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [isPending, startTransition] = useTransition();
  const canCreate = missions.length > 0 && callSigns.length > 0 && drivers.length > 0 && vehicles.length > 0;

  function handleSubmit(formData: FormData) {
    setMessage(null);
    const parsed = createAssignmentSchema.safeParse({
      projectId,
      missionId: formData.get("missionId"),
      callSignId: formData.get("callSignId"),
      driverId: formData.get("driverId"),
      vehicleId: formData.get("vehicleId"),
      startTime: formData.get("startTime") || null,
      endTime: formData.get("endTime") || null,
      metadata: {
        pickupLocation: formData.get("pickupLocation") || "ยังไม่ระบุจุดรับ",
        dropoffLocation: formData.get("dropoffLocation") || "ยังไม่ระบุจุดส่ง",
        driverInstruction: formData.get("driverInstruction") || ""
      }
    });

    if (!parsed.success) {
      setTone("warning");
      setMessage("กรุณาเลือกภารกิจ Call Sign คนขับ และรถให้ครบก่อนสร้างงาน");
      return;
    }

    startTransition(async () => {
      const result = await createAssignmentAction(parsed.data);
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างงานที่จัดสรรไม่สำเร็จ");
        return;
      }
      setTone("success");
      setMessage(result.warning || "สร้างงานสำเร็จ ระบบบันทึก Timeline แล้ว กำลังโหลดข้อมูลใหม่");
      window.setTimeout(() => window.location.reload(), 900);
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid gap-5 p-5">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">เปิดงานใหม่</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          เลือกภารกิจ Call Sign คนขับ และรถ เพื่อสร้างงานที่คนขับจะรับผ่าน QR ได้
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เลือกภารกิจ
          <select className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5" name="missionId" required>
            <option value="">เลือกภารกิจ</option>
            {missions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {mission.missionCode} / {mission.missionName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            Call Sign
            <Tooltip content="Call Sign คือรหัสสื่อสารในงาน เช่น A-01 หรือ VAN-12 ใช้ให้ศูนย์ควบคุมและคนขับอ้างอิงตรงกัน">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
            </Tooltip>
          </span>
          <select className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5" name="callSignId" required>
            <option value="">เลือก Call Sign</option>
            {callSigns.map((callSign) => (
              <option key={callSign.id} value={callSign.id}>
                {callSign.callSign}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เลือกคนขับ
          <select className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5" name="driverId" defaultValue="" required>
            <option value="" disabled>เลือกคนขับ</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName} / {driver.phone || "ยังไม่มีเบอร์"}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เลือกรถ
          <select className="rounded-2xl border border-slate-300 bg-white px-3 py-2.5" name="vehicleId" defaultValue="" required>
            <option value="" disabled>เลือกรถ</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plateNumber} / {vehicle.vehicleType}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          จุดรับ
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="pickupLocation" placeholder="เช่น ประตู 3 อาคารผู้โดยสาร" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          จุดส่ง
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="dropoffLocation" placeholder="เช่น หน้าโรงแรมหรือสถานที่จัดงาน" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เวลาเริ่ม
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="startTime" type="datetime-local" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เวลาสิ้นสุด
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="endTime" type="datetime-local" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          คำสั่งสำหรับคนขับ
          <textarea className="min-h-24 rounded-2xl border border-slate-300 px-3 py-2.5" name="driverInstruction" placeholder="เช่น โทรหาผู้ประสานงานก่อนถึงจุดรับ 10 นาที" />
        </label>
      </div>

      {!canCreate ? (
        <ActionFeedback
          tone="warning"
          message="ต้องมีภารกิจ Call Sign คนขับ และรถก่อน จึงจะสร้างงานและ QR ให้คนขับได้"
        />
      ) : null}
      <ActionFeedback message={message} tone={tone} />
      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={!canCreate || isPending} type="submit">
        {isPending ? "กำลังสร้างงาน..." : "สร้างงานที่จัดสรร"}
      </button>
    </form>
  );
}
