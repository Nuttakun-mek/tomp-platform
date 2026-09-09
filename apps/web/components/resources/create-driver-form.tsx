"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDriverAction } from "@/app/actions/resources";
import { useToast } from "@/components/ui/toast";
import { createDriverSchema } from "@/lib/validation";

export function CreateDriverForm() {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const parsed = createDriverSchema.safeParse({
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      licenseType: formData.get("licenseType") || null,
      languages: [],
      metadata: {}
    });

    if (!parsed.success) {
      toast.warning("กรุณากรอกข้อมูลคนขับที่จำเป็นให้ครบถ้วน");
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
    <form action={handleSubmit} className="grid content-start gap-4 self-start rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">เพิ่มคนขับ</h2>
      <input className="rounded-md border border-slate-300 px-3 py-2" name="fullName" placeholder="ชื่อ-นามสกุล" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="phone" placeholder="เบอร์โทรศัพท์" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="licenseType" placeholder="ประเภทใบขับขี่" />
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกคนขับ"}
      </button>
    </form>
  );
}
