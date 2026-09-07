"use client";

import { useEffect, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { createProjectAction } from "@/app/actions/projects";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { createProjectSchema } from "@/lib/validation";

type FieldErrors = Record<string, string[]>;

function buildProjectCode() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TOMP-${date}-${suffix}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getFeedbackTone(message: string | null) {
  if (!message) return "info" as const;
  if (message.includes("สำเร็จ") || message.includes("บันทึก")) return "success" as const;
  if (message.includes("กรุณา") || message.includes("ถูกใช้แล้ว")) return "warning" as const;
  return "danger" as const;
}

export function CreateProjectForm() {
  const [projectCode, setProjectCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProjectCode(buildProjectCode());
    const currentDate = today();
    setStartDate(currentDate);
    setEndDate(currentDate);
  }, []);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    setFieldErrors({});

    const parsed = createProjectSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      projectCode: formData.get("projectCode"),
      projectName: formData.get("projectName"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      timezone: formData.get("timezone"),
      serviceLevel: formData.get("serviceLevel"),
      visibilityLevel: "internal",
      metadata: { source: "pilot_ui" }
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      setMessage("กรุณากรอกข้อมูลโครงการให้ครบถ้วนก่อนบันทึก");
      return;
    }

    startTransition(async () => {
      const result = await createProjectAction(parsed.data);

      if (!result.success) {
        setFieldErrors(result.fieldErrors || {});
        setMessage(result.error || "สร้างโครงการไม่สำเร็จ");
        return;
      }

      const data = result.data as { project?: { id?: string } };
      setMessage(result.warning || "บันทึกโครงการสำเร็จ กำลังเปิดพื้นที่ทำงานของโครงการ");
      if (data.project?.id) {
        window.location.href = `/projects/${data.project.id}`;
      }
    });
  }

  return (
    <form action={handleSubmit} className="enterprise-panel grid gap-5 p-5">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">สร้างโครงการ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          โครงการคือพื้นที่ทำงานหลักสำหรับรวมภารกิจ งานที่จัดสรร คนขับ รถ QR, GPS และ Timeline ของรอบปฏิบัติการเดียวกัน
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          <span className="flex items-center gap-2">
            รหัสโครงการ
            <Tooltip content="ใช้แยกโครงการในรายงานและหน้าค้นหา ควรไม่ซ้ำกัน เช่น TOMP-20260907-A1B2">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
            </Tooltip>
          </span>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input className="min-w-0 rounded-2xl border border-slate-300 px-3 py-2.5" name="projectCode" value={projectCode} onChange={(event) => setProjectCode(event.target.value)} />
            <button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-operation hover:text-operation"
              type="button"
              onClick={() => setProjectCode(buildProjectCode())}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              สร้างรหัสใหม่
            </button>
          </div>
          <FieldError errors={fieldErrors.projectCode} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ชื่อโครงการ
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="projectName" placeholder="เช่น งานรับส่งผู้ร่วมประชุม" />
          <FieldError errors={fieldErrors.projectName} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          วันที่เริ่มต้น
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <FieldError errors={fieldErrors.startDate} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          วันที่สิ้นสุด
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <FieldError errors={fieldErrors.endDate} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เขตเวลา
          <input className="rounded-2xl border border-slate-300 px-3 py-2.5" name="timezone" defaultValue="Asia/Bangkok" />
          <FieldError errors={fieldErrors.timezone} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          <span className="flex items-center gap-2">
            ระดับบริการ
            <Tooltip content="ใช้บอกระดับความเข้มของการควบคุมงาน ยังไม่ใช่ระบบคิดค่าบริการ">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-300 text-[11px] text-slate-500">?</span>
            </Tooltip>
          </span>
          <select className="rounded-2xl border border-slate-300 px-3 py-2.5" name="serviceLevel" defaultValue="standard">
            <option value="standard">มาตรฐาน</option>
            <option value="premium">ดูแลพิเศษ</option>
            <option value="vip">VIP</option>
          </select>
          <FieldError errors={fieldErrors.serviceLevel} />
        </label>
      </div>

      <ActionFeedback message={message} tone={getFeedbackTone(message)} />
      <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกโครงการ"}
      </button>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <span className="text-xs font-medium text-red-700">{errors[0]}</span>;
}
