"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVehicleAction } from "@/app/actions/resources";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { createVehicleSchema } from "@/lib/validation";

function splitRequirements(value: FormDataEntryValue | null) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CreateVehicleForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage(null);
    const parsed = createVehicleSchema.safeParse({
      plateNumber: formData.get("plateNumber"),
      vehicleType: formData.get("vehicleType"),
      capacity: formData.get("capacity"),
      metadata: {
        requirements: splitRequirements(formData.get("requirements")),
        operationNote: String(formData.get("operationNote") || "").trim()
      }
    });

    if (!parsed.success) {
      setTone("warning");
      setMessage("กรุณากรอกทะเบียนรถ ประเภทรถ และจำนวนที่นั่งให้ครบถ้วน");
      return;
    }

    startTransition(async () => {
      const result = await createVehicleAction(parsed.data);
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างโปรไฟล์รถไม่สำเร็จ");
        return;
      }
      setTone("success");
      setMessage(result.warning || "บันทึกโปรไฟล์รถสำเร็จ");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid content-start gap-4 p-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">สร้างโปรไฟล์รถ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">เพิ่มรถสำหรับใช้งานจริง พร้อมกำหนดข้อปฏิบัติก่อนรับงานของรถคันนั้น</p>
      </div>
      <label className="field-label">
        ทะเบียนรถ
        <input className="field-input" name="plateNumber" placeholder="เช่น 1กข 1234" />
      </label>
      <label className="field-label">
        ประเภทรถ
        <input className="field-input" name="vehicleType" placeholder="เช่น Van, SUV, Sedan" />
      </label>
      <label className="field-label">
        จำนวนที่นั่ง
        <input className="field-input" min={0} name="capacity" placeholder="เช่น 4" type="number" />
      </label>
      <label className="field-label">
        <span className="flex items-center gap-2">
          ข้อกำหนดก่อนรับงาน
          <Tooltip content="กรอกหนึ่งรายการต่อหนึ่งบรรทัด เช่น ถ่ายรูปรถ, ถ่ายรูปป้ายทะเบียน, ยืนยัน GPS">
            <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
          </Tooltip>
        </span>
        <textarea className="field-input min-h-28" name="requirements" placeholder={"ถ่ายรูปรถ\nถ่ายรูปป้ายทะเบียน\nยืนยัน GPS ก่อนเริ่มงาน"} />
      </label>
      <label className="field-label">
        หมายเหตุปฏิบัติการ
        <textarea className="field-input min-h-24" name="operationNote" placeholder="เช่น รถคันนี้ใช้สำหรับแขก VIP หรือกำหนดจุดจอดเฉพาะ" />
      </label>
      <ActionFeedback message={message} tone={tone} />
      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกโปรไฟล์รถ"}
      </button>
    </form>
  );
}
