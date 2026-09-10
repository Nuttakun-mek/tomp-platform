"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDriverAction } from "@/app/actions/resources";
import { useToast } from "@/components/ui/toast";
import { createDriverSchema } from "@/lib/validation";

// Only the name and phone are required: the control room adds people mid-event,
// often from a phone, and a form that demands a licence number before it will
// save is a form people work around. Everything else can be filled in later and
// is worth having when it is there — a driver's language decides which guests
// they can take, and an emergency contact matters exactly once, badly.

const LANGUAGE_OPTIONS = ["ไทย", "อังกฤษ", "จีน", "ญี่ปุ่น"];

function text(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

export function CreateDriverForm({ projectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const languages = LANGUAGE_OPTIONS.filter((language) => formData.get(`lang:${language}`) === "on");

    const parsed = createDriverSchema.safeParse({
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      licenseType: text(formData, "licenseType") || null,
      languages,
      projectId: projectId || null,
      metadata: {
        licenseNumber: text(formData, "licenseNumber"),
        licenseExpiry: text(formData, "licenseExpiry"),
        nickname: text(formData, "nickname"),
        emergencyContactName: text(formData, "emergencyContactName"),
        emergencyContactPhone: text(formData, "emergencyContactPhone"),
        note: text(formData, "note")
      }
    });

    if (!parsed.success) {
      toast.warning("กรอกชื่อ-นามสกุล และเบอร์โทรศัพท์ก่อนบันทึก");
      return;
    }

    startTransition(async () => {
      const result = await createDriverAction(parsed.data);
      if (!result.success) {
        toast.error(result.error || "สร้างข้อมูลคนขับไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "บันทึกข้อมูลคนขับแล้ว");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid content-start gap-4 self-start p-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">เพิ่มคนขับ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          กรอกชื่อและเบอร์ก็บันทึกได้ ส่วนอื่นเติมทีหลังได้ ไม่บังคับ
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label sm:col-span-2">
          ชื่อ-นามสกุล <span className="text-rose-500">*</span>
          <input className="field-input" name="fullName" placeholder="เช่น สมชาย ใจดี" required />
        </label>
        <label className="field-label">
          เบอร์โทรศัพท์ <span className="text-rose-500">*</span>
          <input className="field-input" name="phone" inputMode="tel" placeholder="08x-xxx-xxxx" required />
        </label>
        <label className="field-label">
          ชื่อเล่น <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
          <input className="field-input" name="nickname" placeholder="ใช้เรียกทางวิทยุ" />
        </label>
      </div>

      <fieldset className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
        <legend className="px-1 text-xs font-bold text-slate-600">ใบขับขี่</legend>
        <label className="field-label">
          ประเภท
          <input className="field-input" name="licenseType" placeholder="เช่น ท.2, บ.2" />
        </label>
        <label className="field-label">
          เลขที่
          <input className="field-input" name="licenseNumber" placeholder="เลขใบขับขี่" />
        </label>
        <label className="field-label">
          วันหมดอายุ
          <input className="field-input" name="licenseExpiry" type="date" />
        </label>
      </fieldset>

      <fieldset className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
        <legend className="px-1 text-xs font-bold text-slate-600">ภาษาที่สื่อสารได้</legend>
        <div className="flex flex-wrap gap-3">
          {LANGUAGE_OPTIONS.map((language) => (
            <label key={language} className="flex items-center gap-1.5 text-sm text-ink-soft">
              <input type="checkbox" name={`lang:${language}`} className="h-4 w-4 rounded border-slate-300" />
              {language}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
        <legend className="px-1 text-xs font-bold text-slate-600">ผู้ติดต่อฉุกเฉิน</legend>
        <label className="field-label">
          ชื่อ
          <input className="field-input" name="emergencyContactName" placeholder="เช่น ญาติ / หัวหน้าทีม" />
        </label>
        <label className="field-label">
          เบอร์โทรศัพท์
          <input className="field-input" name="emergencyContactPhone" inputMode="tel" placeholder="08x-xxx-xxxx" />
        </label>
      </fieldset>

      <label className="field-label">
        หมายเหตุ <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
        <textarea className="field-input min-h-20" name="note" placeholder="เช่น ชำนาญเส้นทางสนามบิน, ขับรถตู้ได้" />
      </label>

      <button
        className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกคนขับ"}
      </button>
    </form>
  );
}
