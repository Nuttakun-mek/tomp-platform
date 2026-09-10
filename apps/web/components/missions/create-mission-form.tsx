"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMissionAction } from "@/app/actions/missions";
import { DateTimeField, todayLocalDate } from "@/components/ui/datetime-field";
import { useToast } from "@/components/ui/toast";

// A mission is *what* is being served and *which day* — nothing more. It used to
// ask for a code, a name and a type, three text boxes that all read like "name",
// plus a start and end timestamp that then contradicted the times on the jobs
// underneath it. The times live on the jobs, where a driver can act on them; the
// mission only says which day they belong to.
//
// The code is generated rather than asked for: it is bookkeeping, and making an
// operator invent MIS-001 on the spot is how two missions end up sharing one.

const MISSION_TYPES = [
  { value: "airport_pickup", label: "รับจากสนามบิน" },
  { value: "airport_dropoff", label: "ส่งสนามบิน" },
  { value: "hotel_transfer", label: "รับ-ส่งโรงแรม" },
  { value: "venue_shuttle", label: "รถรับส่งในงาน" },
  { value: "vip", label: "รถรับรอง VIP" },
  { value: "standby", label: "รถสำรอง / สแตนด์บาย" },
  { value: "other", label: "อื่น ๆ" }
];

function autoMissionCode(projectCode: string, existing: number) {
  const prefix = (projectCode || "MIS").split("-").pop()?.slice(0, 6).toUpperCase() || "MIS";
  return `${prefix}-${String(existing + 1).padStart(3, "0")}`;
}

export function CreateMissionForm({
  projectId,
  projectCode = "",
  existingCount = 0,
  projectStartDate,
  projectEndDate
}: {
  projectId: string;
  projectCode?: string;
  existingCount?: number;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [operationDate, setOperationDate] = useState("");

  // Never before today, and never outside the project's own window.
  const minDate = useMemo(() => {
    const today = todayLocalDate();
    return projectStartDate && projectStartDate > today ? projectStartDate : today;
  }, [projectStartDate]);

  function handleSubmit(formData: FormData) {
    const missionName = String(formData.get("missionName") || "").trim();
    if (!missionName || !operationDate) {
      toast.warning("กรอกชื่อภารกิจและเลือกวันปฏิบัติการก่อนบันทึก");
      return;
    }

    startTransition(async () => {
      const result = await createMissionAction({
        projectId,
        missionCode: autoMissionCode(projectCode, existingCount),
        missionName,
        missionType: String(formData.get("missionType") || "other"),
        priority: String(formData.get("priority") || "normal"),
        // The day is the whole point: jobs pick their times inside it.
        plannedStartTime: `${operationDate}T00:00`,
        plannedEndTime: `${operationDate}T23:59`,
        instruction: String(formData.get("serviceCommitment") || "").trim() || null,
        metadata: { operationDate }
      });

      if (!result.success) {
        toast.error(result.error || "สร้างภารกิจไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "บันทึกภารกิจแล้ว");
      setOperationDate("");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid content-start gap-4 p-4">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">สร้างภารกิจ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          ภารกิจคือ <span className="font-semibold text-ink">งานบริการหนึ่งเรื่องในหนึ่งวัน</span> เช่น “รับผู้ร่วมงานจากสนามบิน วันที่ 15”
          ส่วนเวลาจริงของแต่ละคันจะไปกำหนดตอนเปิดงานในขั้นถัดไป
        </p>
      </div>

      <label className="field-label">
        ชื่อภารกิจ <span className="text-rose-500">*</span>
        <input className="field-input" name="missionName" placeholder="เช่น รับผู้ร่วมงานจากสนามบิน รอบเช้า" required />
        <span className="mt-1 text-xs text-slate-500">ตั้งให้อ่านแล้วรู้ว่าทำอะไร ระบบจะสร้างรหัสภารกิจให้เอง</span>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <DateTimeField
          label="วันปฏิบัติการ"
          name="operationDate"
          value={operationDate}
          onChange={setOperationDate}
          min={minDate}
          max={projectEndDate || undefined}
          required
          hint="เลือกวันที่จะให้บริการ"
        />
        <label className="field-label">
          ประเภทภารกิจ
          <select className="field-input" name="missionType" defaultValue="other">
            {MISSION_TYPES.map((type) => (
              <option key={type.value} value={type.label}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>

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
        ข้อผูกพันด้านบริการ <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
        <textarea
          className="field-input min-h-20"
          name="serviceCommitment"
          placeholder="เช่น ต้องถึงจุดรับก่อนเวลา 15 นาที และประสานงานกับผู้จัดงานก่อนปล่อยรถ"
        />
      </label>

      <button
        className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกภารกิจ"}
      </button>
    </form>
  );
}
