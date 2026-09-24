"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRoundCheck, Van } from "lucide-react";
import { createProjectResourcePairAction } from "@/app/actions/resources";
import { FieldHelp } from "@/components/ui/field-help";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { estimateVehicleUsageCost } from "@/lib/domain/vehicle-cost";
import { HourlyRatePreview } from "./hourly-rate-preview";
import { VehicleIconPicker } from "./vehicle-icon-picker";
import { VEHICLE_TYPE_OPTIONS } from "./vehicle-type-options";

export function CreateResourcePairForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [packageHours, setPackageHours] = useState("10");
  const [packageAmount, setPackageAmount] = useState("3000");
  const costPreview = useMemo(() => estimateVehicleUsageCost({
    vehicleMetadata: {
      packageHours: packageHours === "" ? null : Number(packageHours),
      packageAmount: packageAmount === "" ? null : Number(packageAmount)
    }
  }), [packageAmount, packageHours]);

  function submit(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    startTransition(async () => {
      const result = await createProjectResourcePairAction({ ...payload, projectId });
      if (!result.success) {
        toast.error(result.error || "บันทึกชุดคนขับและรถไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "เพิ่มคนขับ รถ และสร้างหน่วยรถให้พร้อมใช้งานแล้ว");
      router.refresh();
    });
  }

  return (
    // No panel or heading of its own: the only place this renders is inside the
    // "เพิ่มคนขับและรถเข้าโครงการนี้" collapsible, which already frames and titles it.
    <form action={submit} className="clean-form grid gap-4">
      {/* content-start: the two columns share a row height, and without it the
          shorter driver column spread its fields out to match the vehicle one. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="form-section content-start">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-operation shadow-sm"><UserRoundCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-ink">ข้อมูลคนขับ</p>
              <p className="text-xs text-ink-faint">ชื่อและเบอร์โทรเป็นข้อมูลที่ต้องมีสำหรับติดต่อระหว่างปฏิบัติงาน</p>
            </div>
          </div>
          <label className="field-label">
            <span className="field-title">ชื่อ-นามสกุล <span className="field-required-badge">*</span></span>
            <input className="field-input" name="fullName" placeholder="เช่น สมชาย ใจดี" required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              <span className="field-title">เบอร์โทรศัพท์ <span className="field-required-badge">*</span></span>
              <input className="field-input" name="phone" inputMode="tel" placeholder="08x-xxx-xxxx" required />
              <span className="field-hint">ใช้สำหรับโทรและส่งข้อมูลปฏิบัติงานให้คนขับ</span>
            </label>
            <label className="field-label">
              ชื่อเล่น
              <input className="field-input" name="nickname" placeholder="ใช้เรียกภายในทีม" />
              <span className="field-hint">ไม่บังคับ ใช้ช่วยจำในศูนย์ควบคุม</span>
            </label>
          </div>
          <label className="field-label">
            ประเภทใบขับขี่
            <input className="field-input" name="licenseType" placeholder="เช่น ท.2, บ.2" />
          </label>
          <label className="field-label">
            หมายเหตุคนขับ
            <textarea className="field-input min-h-20" name="driverNote" placeholder="เช่น ชำนาญเส้นทางสนามบิน / สื่อสารอังกฤษได้" />
          </label>
        </section>

        <section className="form-section content-start">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-operation shadow-sm"><Van className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-ink">ข้อมูลรถ</p>
              <p className="text-xs text-ink-faint">กำหนดชนิดรถเพื่อให้ศูนย์ควบคุมแยกสัญลักษณ์บนแผนที่ได้ชัดเจน</p>
            </div>
          </div>
          {/* The Call Sign names the vehicle unit, so it heads the vehicle side on
              its own row. With the symbol picker down to icons this is the
              shorter column, and the extra row levels it with the driver side. */}
          <label className="field-label">
            <span className="field-title">
              Call Sign
              <FieldHelp content="รหัสประจำหน่วยรถ ใช้ค้นหา มอบหมายงาน และออก QR ในศูนย์ควบคุมและหน้าคนขับ เว้นว่างได้ ระบบจะตั้งให้" />
            </span>
            <input className="field-input" name="callSign" placeholder="เช่น VAN-01 หรือเว้นว่างให้ระบบตั้งให้" />
          </label>
          <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(7rem,0.62fr)]">
            <label className="field-label">
              <span className="field-title">ทะเบียนรถ <span className="field-required-badge">*</span></span>
              <input className="field-input" name="plateNumber" placeholder="เช่น 1กข 1234" required />
            </label>
            <label className="field-label">
              <span className="field-title">ประเภทรถ <span className="field-required-badge">*</span></span>
              <select className="field-input" name="vehicleType" defaultValue="" required>
                <option value="" disabled>เลือกประเภทรถ</option>
                {VEHICLE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <span className="field-hint">เลือกให้ตรงกับลักษณะรถจริง เพื่อช่วยแยกสัญลักษณ์ในศูนย์ควบคุม</span>
            </label>
            <label className="field-label">
              <span className="field-title">จำนวนที่นั่ง <span className="field-required-badge">*</span></span>
              <input className="field-input" name="capacity" min={0} max={80} type="number" placeholder="เช่น 10" required />
            </label>
          </div>
          <div className="grid items-start gap-3 md:grid-cols-3">
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
              <input className="field-input" name="colour" placeholder="เช่น ขาว" />
            </label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              สัญลักษณ์ประเภทรถ
              <Tooltip content="สัญลักษณ์นี้จะถูกใช้กับรถคันนี้ในหน้าศูนย์ควบคุมและแผนที่รวม เพื่อแยกประเภทรถด้วยรูปทรง ไม่ใช้สีซ้ำกับสถานะ GPS">
                <span className="grid h-5 w-5 place-items-center rounded-full border border-border bg-white text-[11px] text-ink-faint">?</span>
              </Tooltip>
            </legend>
            <VehicleIconPicker />
          </fieldset>
        </section>
      </div>

      {/* One row: amount, hours, the rate they produce, and the note. The old
          "ตัวอย่างการคำนวณ" box restated the two numbers just typed above it. */}
      <section className="form-section-white">
        <p className="form-section-title flex items-center gap-1.5">
          ค่าใช้จ่ายในการบริการ
          <FieldHelp content="ยอดค่าใช้จ่ายต่อจำนวนชั่วโมงบริการที่ตกลงไว้ ใช้คำนวณอัตราเฉลี่ยและค่าล่วงเวลา เวลาเริ่มและสิ้นสุดงานกำหนดในหน้าจัดการโครงการ คนขับไม่เห็นตัวเลขนี้ ศูนย์ควบคุมเป็นผู้ตรวจสอบ" />
        </p>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1.6fr)]">
          <label className="field-label">
            ค่าใช้จ่าย (บาท)
            <input className="field-input" name="packageAmount" inputMode="decimal" min={0} step="0.01" type="number" value={packageAmount} onChange={(event) => setPackageAmount(event.target.value)} placeholder="เช่น 3000" />
          </label>
          <label className="field-label">
            จำนวนชั่วโมงบริการ
            <input className="field-input" name="packageHours" inputMode="decimal" min={0} step="0.5" type="number" value={packageHours} onChange={(event) => setPackageHours(event.target.value)} placeholder="เช่น 10" />
          </label>
          <HourlyRatePreview rate={costPreview.hourlyRate} />
          <label className="field-label">
            หมายเหตุ
            <input className="field-input" name="costNote" placeholder="เช่น รวมค่าน้ำมันแล้ว / ค่าล่วงเวลาคิดแยก" />
          </label>
        </div>
      </section>

      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกชุดคนขับและรถ"}
      </button>
    </form>
  );
}
