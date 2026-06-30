"use client";

import { useState } from "react";
import { driverCheckinAction, vehicleCheckinAction, vehiclePhotoUploadAction } from "@/app/actions/driver";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverActivationChecklist({ driverAccess }: { driverAccess?: DriverAccessAssignment }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!driverAccess) {
      setMessage("ไม่พบข้อมูลงาน กรุณาขอ QR ใหม่จากผู้ประสานงาน");
      return;
    }

    setPending(true);
    const driverResult = await driverCheckinAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      status: "ready",
      confirmedName: formData.get("confirmedName") === "on",
      confirmedPhone: formData.get("confirmedPhone") === "on",
      confirmedVehicle: formData.get("confirmedVehicle") === "on",
      gpsConsent: formData.get("gpsConsent") === "on",
      metadata: {
        vehiclePhotoCaptured: formData.get("vehiclePhotoCaptured") === "on",
        platePhotoCaptured: formData.get("platePhotoCaptured") === "on"
      }
    });

    const vehicleResult = await vehicleCheckinAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      vehicleId: driverAccess.vehicle.id,
      driverId: driverAccess.driver.id,
      status: "confirmed",
      photoUrl: null,
      platePhotoUrl: null,
      metadata: {
        photoCaptured: formData.get("vehiclePhotoCaptured") === "on",
        platePhotoCaptured: formData.get("platePhotoCaptured") === "on"
      }
    });

    const photoFormData = new FormData();
    photoFormData.set("projectId", driverAccess.project.id);
    photoFormData.set("assignmentId", driverAccess.assignment.id);
    const vehiclePhoto = formData.get("vehiclePhoto");
    const platePhoto = formData.get("platePhoto");
    if (vehiclePhoto instanceof File) photoFormData.set("vehiclePhoto", vehiclePhoto);
    if (platePhoto instanceof File) photoFormData.set("platePhoto", platePhoto);
    const photoResult = await vehiclePhotoUploadAction(photoFormData);

    setPending(false);
    setMessage(driverResult.success && vehicleResult.success && photoResult.success ? photoResult.warning || "ส่งข้อมูลความพร้อมแล้ว" : driverResult.error || vehicleResult.error || photoResult.error || "ส่งข้อมูลไม่สำเร็จ");
  }

  const checklist = [
    ["confirmedName", "ยืนยันชื่อคนขับ"],
    ["confirmedPhone", "ยืนยันเบอร์โทรศัพท์"],
    ["confirmedVehicle", "ยืนยันรถที่ได้รับมอบหมาย"],
    ["gpsConsent", "ยินยอมเปิดตำแหน่ง GPS ระหว่างปฏิบัติงาน"],
    ["vehiclePhotoCaptured", "ถ่ายรูปรถ"],
    ["platePhotoCaptured", "ถ่ายรูปป้ายทะเบียน"]
  ] as const;

  return (
    <form action={handleSubmit} className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-ink">ยืนยันความพร้อม</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">ตรวจข้อมูลสำคัญก่อนเริ่มงาน ภาพถ่ายจะถูกใช้สำหรับยืนยันการรับรถในรอบทดสอบภายใน</p>
      </div>

      <div className="mt-4 grid gap-3">
        {checklist.map(([name, label]) => (
          <label key={name} className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <input className="h-5 w-5 accent-teal-700" name={name} type="checkbox" />
            {label}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ถ่ายรูปรถ
          <input className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" name="vehiclePhoto" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ถ่ายรูปป้ายทะเบียน
          <input className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" name="platePhoto" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
      </div>

      {message ? <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="mt-4 min-h-14 w-full rounded-md bg-operation px-4 py-3 text-base font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={pending} type="submit">
        {pending ? "กำลังส่งข้อมูล..." : "ส่งข้อมูลความพร้อม"}
      </button>
    </form>
  );
}
