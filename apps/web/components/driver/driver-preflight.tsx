"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { driverCheckinAction, recordVehicleEvidenceAction } from "@/app/actions/driver";
import { DriverPhotoCheck } from "@/components/driver/driver-photo-check";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

const CONFIRMS = [
  ["name", "ชื่อคนขับถูกต้อง"],
  ["phone", "เบอร์โทรถูกต้อง"],
  ["vehicle", "รถและทะเบียนถูกต้อง"],
  ["gps", "ยินยอมเปิด GPS ระหว่างปฏิบัติงาน"]
] as const;

export function DriverPreflight({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const router = useRouter();
  const [checks, setChecks] = useState({ name: false, phone: false, vehicle: false, gps: false });
  const [photos, setPhotos] = useState<{ vehicle?: string; plate?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allChecked = CONFIRMS.every(([key]) => checks[key]);
  const photosReady = Boolean(photos.vehicle && photos.plate);
  const ready = allChecked && photosReady;

  function submit() {
    if (!ready) {
      setError(!photosReady ? "กรุณาถ่ายรูปรถและป้ายทะเบียนให้ครบ" : "กรุณายืนยันรายการให้ครบก่อนเริ่มงาน");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await driverCheckinAction({
        projectId: driverAccess.project.id,
        assignmentId: driverAccess.assignment.id,
        driverId: driverAccess.driver.id,
        status: "ready",
        confirmedName: checks.name,
        confirmedPhone: checks.phone,
        confirmedVehicle: checks.vehicle,
        gpsConsent: checks.gps,
        metadata: { via: "driver_preflight", photoPaths: photos }
      });
      if (!result.success) {
        setError(result.error || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      await recordVehicleEvidenceAction({
        vehiclePath: photos.vehicle,
        platePath: photos.plate
      }).catch(() => undefined);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 pb-6">
      <header className="grid gap-1 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-operation-soft text-operation">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-1 text-lg font-bold text-ink">ตรวจสอบก่อนเริ่มงาน</h1>
        <p className="text-[12px] text-ink-soft">ยืนยันข้อมูลและถ่ายรูปหลักฐาน จากนั้นจึงเข้าสู่หน้างาน</p>
      </header>

      {/* your vehicle */}
      <section className="smart-card grid gap-1.5 text-[13px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-operation">{driverAccess.project.projectName}</p>
        <p className="text-base font-bold text-ink">Call Sign {driverAccess.callSign.callSign}</p>
        <p><span className="font-semibold text-ink">คนขับ</span> · {driverAccess.driver.fullName} · {driverAccess.driver.phone || "ไม่มีเบอร์"}</p>
        <p><span className="font-semibold text-ink">รถของคุณ</span> · {driverAccess.vehicle.plateNumber} · {driverAccess.vehicle.vehicleType} · {driverAccess.vehicle.capacity || 0} ที่นั่ง</p>
      </section>

      <section className="smart-card grid gap-3">
        <DriverPhotoCheck onChange={setPhotos} />

        <div className="grid gap-1.5">
          <p className="text-[13px] font-semibold text-ink">ยืนยันรายการ</p>
          {CONFIRMS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 rounded-card border border-border bg-white px-3 py-2.5 text-[13px]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-teal-700"
                checked={checks[key]}
                onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>

        {error ? <p className="rounded-card bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={isPending || !ready}
          className="flex min-h-14 items-center justify-center gap-2 rounded-command bg-operation px-4 text-[16px] font-bold text-white disabled:opacity-60"
        >
          <CheckCircle2 className="h-5 w-5" />
          {isPending ? "กำลังบันทึก…" : ready ? "ยืนยันและเริ่มงาน" : "ตรวจสอบให้ครบก่อน"}
        </button>
      </section>
    </div>
  );
}
