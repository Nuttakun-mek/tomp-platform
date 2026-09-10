"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVehicleAction } from "@/app/actions/resources";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { createVehicleSchema } from "@/lib/validation";

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

export function CreateVehicleForm() {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const parsed = createVehicleSchema.safeParse({
      plateNumber: formData.get("plateNumber"),
      vehicleType: formData.get("vehicleType"),
      capacity: formData.get("capacity"),
      metadata: {
        brand: text(formData, "brand"),
        model: text(formData, "model"),
        colour: text(formData, "colour"),
        year: text(formData, "year"),
        photoUrl: text(formData, "photoUrl"),
        luggageCapacity: text(formData, "luggageCapacity"),
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
          รายละเอียดของรถอย่างเดียว คนขับจะจับคู่ทีหลังตอนสร้างหน่วยรถ กรอกเท่าที่มี ไม่บังคับทั้งหมด
        </p>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="px-1 text-xs font-bold text-slate-600">ข้อมูลที่ต้องมี</legend>
        <label className="field-label">
          ทะเบียนรถ <span className="text-rose-500">*</span>
          <input className="field-input" name="plateNumber" placeholder="เช่น 1กข 1234" required />
        </label>
        <label className="field-label">
          ประเภทรถ <span className="text-rose-500">*</span>
          <input className="field-input" name="vehicleType" list="vehicle-types" placeholder="เช่น Van, SUV, Sedan" required />
          <datalist id="vehicle-types">
            <option value="Sedan" />
            <option value="SUV" />
            <option value="Van" />
            <option value="Minibus" />
            <option value="Bus" />
            <option value="Pickup" />
          </datalist>
        </label>
        <label className="field-label">
          จำนวนที่นั่ง <span className="text-rose-500">*</span>
          <input className="field-input" min={0} max={80} name="capacity" placeholder="เช่น 4" type="number" required />
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
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

      <fieldset className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
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
