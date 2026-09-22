"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRoundCheck, Van } from "lucide-react";
import { createProjectResourcePairAction } from "@/app/actions/resources";
import { FieldHelp } from "@/components/ui/field-help";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { estimateVehicleUsageCost, vehicleUsageCostBreakdown } from "@/lib/domain/vehicle-cost";
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
    <form action={submit} className="enterprise-panel clean-form grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">เพิ่มชุดคนขับและรถ</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
            ใช้สำหรับสร้างคนขับ รถ และหน่วยรถของโครงการในขั้นตอนเดียว ระบบจะผูกคู่ให้อัตโนมัติ ไม่ต้องจับคู่ซ้ำในหน้าจัดการโครงการ
          </p>
        </div>
        <span className="rounded-full bg-operation-soft px-3 py-1 text-xs font-semibold text-operation">บันทึกเป็นทรัพยากรของโครงการ</span>
      </div>

      <section className="form-section-white border-operation/25 bg-operation-soft/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Call Sign</p>
            <p className="text-xs leading-5 text-ink-faint">กำหนดรหัสประจำหน่วยรถตั้งแต่ขั้นตอนแรก เพื่อให้ค้นหา มอบหมายงาน และออก QR ได้ถูกต้อง</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-operation shadow-sm">ควรกำหนดก่อนบันทึก</span>
        </div>
        <label className="field-label max-w-2xl">
          <span className="field-title">
            Call Sign
            <FieldHelp content="ใช้เป็นรหัสอ้างอิงของรถและคนขับในศูนย์ควบคุม QR และหน้าคนขับ" />
          </span>
          <input className="field-input" name="callSign" placeholder="เช่น VAN-01 หรือเว้นว่างให้ระบบตั้งให้" />
          <span className="field-hint">ใช้เป็นรหัสอ้างอิงของรถและคนขับในศูนย์ควบคุม QR และหน้าคนขับ</span>
        </label>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="form-section">
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

        <section className="form-section">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-operation shadow-sm"><Van className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-ink">ข้อมูลรถ</p>
              <p className="text-xs text-ink-faint">กำหนดชนิดรถเพื่อให้ศูนย์ควบคุมแยกสัญลักษณ์บนแผนที่ได้ชัดเจน</p>
            </div>
          </div>
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

      <section className="form-section-white">
        <div>
          <p className="text-sm font-semibold text-ink">ค่าใช้จ่ายในการบริการ</p>
          <p className="text-xs leading-5 text-ink-faint">กำหนดจำนวนชั่วโมงบริการและยอดค่าใช้จ่ายต่อหน่วยรถ ส่วนเวลาเริ่มและสิ้นสุดงานจะกำหนดในหน้าจัดการโครงการเท่านั้น</p>
        </div>
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_17rem]">
          <label className="field-label">
            ค่าใช้จ่ายในการบริการ (บาท)
            <input className="field-input" name="packageAmount" inputMode="decimal" min={0} step="0.01" type="number" value={packageAmount} onChange={(event) => setPackageAmount(event.target.value)} placeholder="เช่น 3000" />
            <span className="field-hint">ยอดค่าใช้จ่ายสำหรับจำนวนชั่วโมงบริการที่ตกลงไว้</span>
          </label>
          <label className="field-label">
            จำนวนชั่วโมงบริการ
            <input className="field-input" name="packageHours" inputMode="decimal" min={0} step="0.5" type="number" value={packageHours} onChange={(event) => setPackageHours(event.target.value)} placeholder="เช่น 10" />
            <span className="field-hint">ใช้คำนวณอัตราเฉลี่ยและค่าล่วงเวลาเมื่อเกินเวลาที่กำหนด</span>
          </label>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-canvas/60 px-3 py-2 lg:-mt-1 lg:min-h-[4.75rem]">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink">ตัวอย่างการคำนวณ</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-soft">{vehicleUsageCostBreakdown(costPreview)}</p>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-ink-faint">คนขับเห็นเฉพาะการบันทึกเวลาเข้าออกและรายการปฏิบัติงาน ศูนย์ควบคุมเป็นผู้ตรวจสอบข้อมูลการคำนวณ</p>
          </div>
          <div className="shrink-0 rounded-xl bg-operation-soft px-3 py-2 text-right lg:mt-1">
            <p className="text-[11px] font-semibold text-operation">อัตราเฉลี่ย</p>
            <p className="text-lg font-bold text-operation">
              {costPreview.hourlyRate != null ? `${costPreview.hourlyRate.toLocaleString("th-TH")} บ./ชม.` : "ยังคำนวณไม่ได้"}
            </p>
          </div>
          </div>
        </div>
        <label className="field-label">
          หมายเหตุค่าใช้จ่ายในการบริการ
          <input className="field-input" name="costNote" placeholder="เช่น รวมค่าน้ำมันแล้ว / ค่าล่วงเวลาคิดแยก" />
          <span className="field-hint">แสดงเป็นข้อมูลประกอบ ไม่ใช้แทนตัวเลขคำนวณ</span>
        </label>
      </section>

      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกชุดคนขับและรถ"}
      </button>
    </form>
  );
}
