"use client";

import { useMemo, useState, useTransition } from "react";
import { createProjectAction } from "@/app/actions/projects";
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

export function CreateProjectForm() {
  const initialCode = useMemo(() => buildProjectCode(), []);
  const [projectCode, setProjectCode] = useState(initialCode);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

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
      setMessage("กรุณากรอกข้อมูลโครงการให้ครบถ้วน");
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
      setMessage(result.warning || "บันทึกโครงการสำเร็จ กำลังเปิดหน้าโครงการ");
      if (data.project?.id) {
        window.location.href = `/projects/${data.project.id}`;
      }
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-ink">สร้างโครงการ</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">โครงการคือพื้นที่หลักสำหรับรวมภารกิจ ทรัพยากร Assignment และ Timeline</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          รหัสโครงการ
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2.5" name="projectCode" value={projectCode} onChange={(event) => setProjectCode(event.target.value)} />
            <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700" type="button" onClick={() => setProjectCode(buildProjectCode())}>
              สร้างใหม่
            </button>
          </div>
          <FieldError errors={fieldErrors.projectCode} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ชื่อโครงการ
          <input className="rounded-md border border-slate-300 px-3 py-2.5" name="projectName" placeholder="งานรับส่งผู้ร่วมประชุม" />
          <FieldError errors={fieldErrors.projectName} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          วันที่เริ่มต้น
          <input className="rounded-md border border-slate-300 px-3 py-2.5" name="startDate" type="date" defaultValue={today()} />
          <FieldError errors={fieldErrors.startDate} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          วันที่สิ้นสุด
          <input className="rounded-md border border-slate-300 px-3 py-2.5" name="endDate" type="date" defaultValue={today()} />
          <FieldError errors={fieldErrors.endDate} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          เขตเวลา
          <input className="rounded-md border border-slate-300 px-3 py-2.5" name="timezone" defaultValue="Asia/Bangkok" />
          <FieldError errors={fieldErrors.timezone} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          ระดับบริการ
          <select className="rounded-md border border-slate-300 px-3 py-2.5" name="serviceLevel" defaultValue="standard">
            <option value="standard">มาตรฐาน</option>
            <option value="premium">พรีเมียม</option>
            <option value="vip">VIP</option>
          </select>
          <FieldError errors={fieldErrors.serviceLevel} />
        </label>
      </div>

      {message ? (
        <p className={`rounded-md p-3 text-sm font-medium ${message.includes("สำเร็จ") ? "bg-teal-50 text-teal-900" : "bg-red-50 text-red-900"}`}>
          {message}
        </p>
      ) : null}
      <button className="w-fit rounded-md bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
        {isPending ? "กำลังบันทึก..." : "บันทึกโครงการ"}
      </button>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <span className="text-xs font-medium text-red-700">{errors[0]}</span>;
}
