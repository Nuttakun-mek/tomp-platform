"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bike, BusFront, CarFront, Truck, UserRoundCheck, Van } from "lucide-react";
import { createProjectResourcePairAction } from "@/app/actions/resources";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";

const VEHICLE_ICONS = [
  { key: "sedan", label: "เก๋ง", icon: CarFront },
  { key: "suv", label: "SUV", icon: CarFront },
  { key: "van", label: "รถตู้", icon: Van },
  { key: "minibus", label: "มินิบัส", icon: BusFront },
  { key: "bus", label: "รถบัส", icon: BusFront },
  { key: "pickup", label: "กระบะ", icon: Truck },
  { key: "truck", label: "รถบรรทุก", icon: Truck },
  { key: "motorcycle", label: "มอเตอร์ไซค์", icon: Bike }
];

export function CreateResourcePairForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    startTransition(async () => {
      const result = await createProjectResourcePairAction({ ...payload, projectId });
      if (!result.success) {
        toast.error(result.error || "บันทึกชุดคนขับและรถไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "เพิ่มคนขับและรถเข้าโครงการแล้ว");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="enterprise-panel grid gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">เพิ่มชุดคนขับและรถ</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
            ใช้สำหรับสร้างทรัพยากรภายในโครงการเป็นคู่เดียวกันก่อนนำไปจัดเป็น Call Sign และออก QR ในหน้าจัดงาน
          </p>
        </div>
        <span className="rounded-full bg-operation-soft px-3 py-1 text-xs font-semibold text-operation">บันทึกเป็นทรัพยากรของโครงการ</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid gap-3 rounded-2xl border border-border/80 bg-canvas/45 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-operation shadow-sm"><UserRoundCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-ink">ข้อมูลคนขับ</p>
              <p className="text-xs text-ink-faint">ชื่อและเบอร์โทรเป็นข้อมูลที่ต้องมีสำหรับติดต่อระหว่างปฏิบัติงาน</p>
            </div>
          </div>
          <label className="field-label">
            ชื่อ-นามสกุล <span className="text-danger">*</span>
            <input className="field-input" name="fullName" placeholder="เช่น สมชาย ใจดี" required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              เบอร์โทรศัพท์ <span className="text-danger">*</span>
              <input className="field-input" name="phone" inputMode="tel" placeholder="08x-xxx-xxxx" required />
            </label>
            <label className="field-label">
              ชื่อเล่น
              <input className="field-input" name="nickname" placeholder="ใช้เรียกภายในทีม" />
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

        <section className="grid gap-3 rounded-2xl border border-border/80 bg-canvas/45 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-operation shadow-sm"><Van className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-ink">ข้อมูลรถ</p>
              <p className="text-xs text-ink-faint">กำหนดชนิดรถเพื่อให้ศูนย์ควบคุมแยกสัญลักษณ์บนแผนที่ได้ชัดเจน</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field-label">
              ทะเบียนรถ <span className="text-danger">*</span>
              <input className="field-input" name="plateNumber" placeholder="เช่น 1กข 1234" required />
            </label>
            <label className="field-label">
              ประเภทรถ <span className="text-danger">*</span>
              <input className="field-input" name="vehicleType" placeholder="เช่น Van" required />
            </label>
            <label className="field-label">
              จำนวนที่นั่ง <span className="text-danger">*</span>
              <input className="field-input" name="capacity" min={0} max={80} type="number" placeholder="เช่น 10" required />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VEHICLE_ICONS.map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-2 text-[12px] font-semibold text-ink-soft transition has-[:checked]:border-operation has-[:checked]:bg-operation-soft has-[:checked]:text-operation">
                  <input className="sr-only" type="radio" name="vehicleIcon" value={key} defaultChecked={key === "van"} />
                  <Icon className="h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      </div>

      <section className="grid gap-3 rounded-2xl border border-border/80 bg-white p-3 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-ink">เวลาใช้งานและอัตราค่าจ้างเริ่มต้น</p>
          <p className="text-xs leading-5 text-ink-faint">ใช้เป็นข้อมูลสำหรับคำนวณชั่วโมงใช้งานและประมาณค่าจ้างในหน้าจัดงานหรือศูนย์ควบคุม ปรับรายละเอียดรายงานได้ภายหลัง</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="field-label">
            เริ่มงานปกติ
            <input className="field-input" name="defaultDutyStart" type="time" defaultValue="08:00" />
          </label>
          <label className="field-label">
            เลิกงานปกติ
            <input className="field-input" name="defaultDutyEnd" type="time" defaultValue="18:00" />
          </label>
          <label className="field-label">
            ค่าจ้างต่อชั่วโมง
            <input className="field-input" name="hourlyRate" inputMode="decimal" min={0} step="0.01" type="number" placeholder="เช่น 450" />
          </label>
          <label className="field-label">
            ชั่วโมงขั้นต่ำ
            <input className="field-input" name="minimumHours" inputMode="decimal" min={0} step="0.5" type="number" placeholder="เช่น 4" />
          </label>
        </div>
        <label className="field-label">
          หมายเหตุค่าจ้าง
          <input className="field-input" name="costNote" placeholder="เช่น รวมค่าน้ำมันแล้ว / OT คิดแยก" />
        </label>
      </section>

      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกชุดคนขับและรถ"}
      </button>
    </form>
  );
}
