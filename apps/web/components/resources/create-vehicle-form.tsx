"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVehicleAction } from "@/app/actions/resources";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { DateRangeFields } from "@/components/ui/datetime-field";
import { estimateVehicleUsageCost, vehicleUsageCostBreakdown } from "@/lib/domain/vehicle-cost";
import { createVehicleSchema } from "@/lib/validation";
import { ServiceTimeSummary } from "./service-time-summary";
import { VehicleIconPicker } from "./vehicle-icon-picker";
import { VEHICLE_TYPE_OPTIONS } from "./vehicle-type-options";

// This describes the vehicle and nothing else. Who drives it is decided when the
// Call Sign is crewed, and what it is doing is decided when work is planned onto
// that Call Sign — mixing any of that in here is what made the same driver get
// picked twice for different jobs.
//
// Plate, type and seats are required because dispatch cannot use a vehicle
// without them. Everything else exists so the control room can tell two white
// vans apart over the radio, and none of it is worth blocking a save for.

const COLOUR_OPTIONS = ["ขาว", "ดำ", "เงิน", "เทา", "น้ำเงิน", "แดง", "อื่น ๆ"];

function splitRequirements(value: FormDataEntryValue | null) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function text(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

export function CreateVehicleForm({ projectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [defaultDutyStart, setDefaultDutyStart] = useState("08:00");
  const [defaultDutyEnd, setDefaultDutyEnd] = useState("18:00");
  const [packageHours, setPackageHours] = useState("10");
  const [packageAmount, setPackageAmount] = useState("3000");
  const [isPending, startTransition] = useTransition();
  const costPreview = useMemo(() => estimateVehicleUsageCost({
    vehicleMetadata: {
      defaultDutyStart,
      defaultDutyEnd,
      packageHours: packageHours === "" ? null : Number(packageHours),
      packageAmount: packageAmount === "" ? null : Number(packageAmount)
    }
  }), [defaultDutyEnd, defaultDutyStart, packageAmount, packageHours]);

  function handleSubmit(formData: FormData) {
    const parsed = createVehicleSchema.safeParse({
      plateNumber: formData.get("plateNumber"),
      vehicleType: formData.get("vehicleType"),
      capacity: formData.get("capacity"),
      projectId: projectId || null,
      metadata: {
        brand: text(formData, "brand"),
        model: text(formData, "model"),
        colour: text(formData, "colour"),
        year: text(formData, "year"),
        photoUrl: text(formData, "photoUrl"),
        luggageCapacity: text(formData, "luggageCapacity"),
        defaultDutyStart: text(formData, "defaultDutyStart"),
        defaultDutyEnd: text(formData, "defaultDutyEnd"),
        icon: text(formData, "vehicleIcon") || "van",
        packageHours: packageHours === "" ? null : Number(packageHours),
        packageAmount: packageAmount === "" ? null : Number(packageAmount),
        hourlyRate: costPreview.hourlyRate,
        minimumHours: packageHours === "" ? null : Number(packageHours),
        requirements: splitRequirements(formData.get("requirements")),
        operationNote: text(formData, "operationNote")
      }
    });

    if (!parsed.success) {
      toast.warning("กรอกทะเบียนรถ ประเภทรถ และจำนวนที่นั่งก่อนบันทึก");
      return;
    }

    startTransition(async () => {
      const result = await createVehicleAction(parsed.data);
      if (!result.success) {
        toast.error(result.error || "สร้างโปรไฟล์รถไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "บันทึกโปรไฟล์รถสำเร็จ");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid content-start gap-4 p-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">เพิ่มรถ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          บันทึกรายละเอียดรถเพื่อเตรียมใช้งานในโครงการ คนขับจะถูกจับคู่ในขั้นตอนสร้างหน่วยรถ
        </p>
      </div>

      <fieldset className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(7rem,0.62fr)]">
        <legend className="px-1 text-xs font-bold text-slate-600">ข้อมูลที่ต้องมี</legend>
        <label className="field-label">
          <span className="field-title">ทะเบียนรถ <span className="field-required-badge">จำเป็น</span></span>
          <input className="field-input" name="plateNumber" placeholder="เช่น 1กข 1234" required />
        </label>
        <label className="field-label">
          <span className="field-title">ประเภทรถ <span className="field-required-badge">จำเป็น</span></span>
          <select className="field-input" name="vehicleType" defaultValue="" required>
            <option value="" disabled>เลือกประเภทรถ</option>
            {VEHICLE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <span className="field-hint">ใช้จัดกลุ่มสัญลักษณ์รถในศูนย์ควบคุม</span>
        </label>
        <label className="field-label">
          <span className="field-title">จำนวนที่นั่ง <span className="field-required-badge">จำเป็น</span></span>
          <input className="field-input" min={0} max={80} name="capacity" placeholder="เช่น 4" type="number" required />
        </label>
      </fieldset>

      <fieldset className="form-section md:grid-cols-2">
        <legend className="px-1 text-xs font-bold text-slate-600">รายละเอียดรถ (ไม่บังคับ)</legend>
        <label className="field-label">
          ยี่ห้อ
          <input className="field-input" name="brand" placeholder="เช่น Toyota" />
        </label>
        <label className="field-label">
          รุ่น
          <input className="field-input" name="model" placeholder="เช่น Commuter" />
        </label>
        <label className="field-label">
          สี
          <input className="field-input" name="colour" list="vehicle-colours" placeholder="เช่น ขาว" />
          <span className="field-hint">ใช้แยกรถประเภทเดียวกันระหว่างปฏิบัติงาน</span>
          <datalist id="vehicle-colours">
            {COLOUR_OPTIONS.map((colour) => (
              <option key={colour} value={colour} />
            ))}
          </datalist>
        </label>
        <label className="field-label">
          ปีรถ
          <input className="field-input" name="year" inputMode="numeric" placeholder="เช่น 2022" />
        </label>
        <label className="field-label">
          ความจุสัมภาระ
          <input className="field-input" name="luggageCapacity" placeholder="เช่น กระเป๋าใหญ่ 4 ใบ" />
        </label>
        <label className="field-label">
          <span className="flex items-center gap-2">
            ลิงก์รูปรถ
            <Tooltip content="วางลิงก์รูปที่เปิดดูได้ เช่นจาก Google Drive แบบแชร์สาธารณะ ใช้ให้ศูนย์ควบคุมแยกรถสีเดียวกันออกจากกัน">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
            </Tooltip>
          </span>
          <input className="field-input" name="photoUrl" type="url" placeholder="https://..." />
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend className="flex items-center gap-2 px-1 text-xs font-bold text-slate-600">
          สัญลักษณ์ประเภทรถ
          <Tooltip content="สัญลักษณ์นี้ใช้แยกรถในศูนย์ควบคุมและแผนที่รวม เลือกรูปแบบที่ใกล้เคียงกับรถจริงที่สุด">
            <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-white text-[11px] text-ink-faint">?</span>
          </Tooltip>
        </legend>
        <VehicleIconPicker />
      </fieldset>

      <fieldset className="form-section md:grid-cols-2 xl:grid-cols-4">
        <legend className="px-1 text-xs font-bold text-slate-600">เวลามาตรฐานและค่าใช้จ่ายในการบริการ</legend>
        <div className="xl:col-span-2">
          <DateRangeFields
            legend="เวลามาตรฐาน"
            startLabel="เวลาเริ่มต้น"
            endLabel="เวลาสิ้นสุด"
            startName="defaultDutyStart"
            endName="defaultDutyEnd"
            start={defaultDutyStart}
            end={defaultDutyEnd}
            onStart={setDefaultDutyStart}
            onEnd={setDefaultDutyEnd}
            timeOnly
          />
        </div>
        <label className="field-label">
          ค่าใช้จ่ายในการบริการ (บาท)
          <input className="field-input" name="packageAmount" inputMode="decimal" min={0} step="0.01" type="number" value={packageAmount} onChange={(event) => setPackageAmount(event.target.value)} placeholder="เช่น 3000" />
        </label>
        <label className="field-label">
          จำนวนชั่วโมงที่ครอบคลุม
          <input className="field-input" name="packageHours" inputMode="decimal" min={0} step="0.5" type="number" value={packageHours} onChange={(event) => setPackageHours(event.target.value)} placeholder="เช่น 10" />
        </label>
        <div className="rounded-2xl border border-slate-200 bg-canvas/60 p-3 sm:col-span-4">
          <p className="text-sm font-semibold text-ink">ตัวอย่างการคำนวณ</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">{vehicleUsageCostBreakdown(costPreview)}</p>
          <p className="mt-1 text-[11px] leading-4 text-ink-faint">
            หากคนขับบันทึกเวลาเข้าก่อนเวลาเริ่ม ระบบจะไม่คำนวณค่าใช้จ่ายก่อนเวลาแผน และจะคำนวณค่าล่วงเวลาเมื่อบันทึกเวลาออกเกินเวลาที่กำหนด
          </p>
        </div>
        <div className="sm:col-span-4">
          <ServiceTimeSummary start={defaultDutyStart} end={defaultDutyEnd} packageHours={packageHours} />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="px-1 text-xs font-bold text-slate-600">ก่อนรับงาน (ไม่บังคับ)</legend>
        <label className="field-label">
          <span className="flex items-center gap-2">
            ข้อกำหนดก่อนรับงาน
            <Tooltip content="กรอกหนึ่งรายการต่อหนึ่งบรรทัด เช่น ถ่ายรูปรถ, ถ่ายรูปป้ายทะเบียน, ยืนยัน GPS">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
            </Tooltip>
          </span>
          <textarea className="field-input min-h-24" name="requirements" placeholder={"ถ่ายรูปรถ\nถ่ายรูปป้ายทะเบียน\nยืนยัน GPS ก่อนเริ่มงาน"} />
        </label>
        <label className="field-label">
          หมายเหตุปฏิบัติการ
          <textarea className="field-input min-h-20" name="operationNote" placeholder="เช่น รถคันนี้ใช้สำหรับแขก VIP หรือกำหนดจุดจอดเฉพาะ" />
        </label>
      </fieldset>

      <button
        className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกรถ"}
      </button>
    </form>
  );
}
