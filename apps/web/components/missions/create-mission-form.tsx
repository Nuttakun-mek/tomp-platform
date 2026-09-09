"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMissionAction } from "@/app/actions/missions";
import { useToast } from "@/components/ui/toast";
import { createMissionSchema } from "@/lib/validation";

export function CreateMissionForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    const parsed = createMissionSchema.safeParse({
      projectId,
      missionCode: formData.get("missionCode"),
      missionName: formData.get("missionName"),
      missionType: formData.get("missionType"),
      priority: formData.get("priority"),
      plannedStartTime: formData.get("plannedStartTime") || null,
      plannedEndTime: formData.get("plannedEndTime") || null,
      serviceCommitment: formData.get("serviceCommitment") || null,
      metadata: { source: "project_detail_form" }
    });

    if (!parsed.success) {
      toast.warning("กรุณากรอกข้อมูลภารกิจที่จำเป็นให้ครบถ้วน");
      return;
    }

    startTransition(async () => {
      const result = await createMissionAction(parsed.data);
      if (!result.success) {
        toast.error(result.error || "สร้างภารกิจไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "บันทึกภารกิจแล้ว");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid content-start gap-4 p-4">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">สร้างภารกิจ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">ภารกิจคือกิจกรรมบริการ เช่น รับผู้โดยสาร ส่งผู้ร่วมงาน หรือรถรับรอง</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field-label">
          รหัสภารกิจ
          <input className="field-input" name="missionCode" placeholder="MIS-001" required />
        </label>
        <label className="field-label">
          ชื่อภารกิจ
          <input className="field-input" name="missionName" placeholder="รับผู้โดยสารจากสนามบินรอบเช้า" required />
        </label>
        <label className="field-label">
          ประเภทภารกิจ
          <input className="field-input" name="missionType" placeholder="รับจากสนามบิน" required />
        </label>
        <label className="field-label">
          ความสำคัญ
          <select className="field-input" name="priority" defaultValue="normal">
            <option value="low">ต่ำ</option>
            <option value="normal">ปกติ</option>
            <option value="high">สูง</option>
            <option value="critical">วิกฤต</option>
          </select>
        </label>
        <label className="field-label">
          เวลาเริ่มต้น
          <input className="field-input" name="plannedStartTime" type="datetime-local" />
        </label>
        <label className="field-label">
          เวลาสิ้นสุด
          <input className="field-input" name="plannedEndTime" type="datetime-local" />
        </label>
      </div>

      <label className="field-label">
        ข้อผูกพันด้านบริการ
        <textarea className="field-input min-h-24" name="serviceCommitment" placeholder="เช่น ต้องถึงจุดรับก่อนเวลา 15 นาที และประสานงานกับผู้จัดงานก่อนปล่อยรถ" />
      </label>

      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกภารกิจ"}
      </button>
    </form>
  );
}
