"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { provisionUserAction } from "@/app/actions/superadmin-users";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { roleLabelTh } from "@/lib/i18n/role-th";

interface Option {
  id: string;
  label: string;
}

const PROJECT_ROLES = ["project_manager", "dispatcher", "coordinator", "customer_viewer"];

const PROJECT_ROLE_HINT: Record<string, string> = {
  project_manager: "จัดการโครงการทั้งหมด รวมประกาศใช้แผน",
  dispatcher: "จัดสรรงาน สร้าง QR ดูคนขับและรถ",
  coordinator: "ดูงานและยืนยันสถานะในพื้นที่",
  customer_viewer: "ดูอย่างเดียว + ส่งคำขอเปลี่ยนแปลง"
};

export function InviteUserForm({ organizations, projects }: { organizations: Option[]; projects: Option[] }) {
  const orgId = organizations[0]?.id ?? "";
  const [kind, setKind] = useState<"staff" | "admin">("staff");
  const [projectRole, setProjectRole] = useState("dispatcher");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("danger");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await provisionUserAction({
        email: formData.get("email"),
        fullName: formData.get("fullName"),
        organizationId: orgId,
        globalRoleKey: kind === "admin" ? "super_admin" : undefined,
        projectId: kind === "staff" ? formData.get("projectId") || undefined : undefined,
        projectRoleKey: kind === "staff" ? projectRole : undefined
      });
      if (result.success) {
        setTone("success");
        const temp =
          result.data && typeof result.data === "object" && "tempPassword" in result.data ? String(result.data.tempPassword) : null;
        setMessage(
          temp
            ? `เพิ่มผู้ใช้แล้ว — ส่งอีเมลและรหัสผ่านชั่วคราวนี้ให้ผู้ใช้ (ให้เปลี่ยนหลังเข้าครั้งแรก): ${temp}`
            : "เพิ่มผู้ใช้แล้ว"
        );
      } else {
        setTone("danger");
        setMessage(result.error || "เพิ่มผู้ใช้ไม่สำเร็จ");
      }
    });
  }

  return (
    <form action={submit} className="enterprise-panel grid content-start gap-4 p-4">
      <div>
        <p className="section-label">เพิ่มผู้ใช้</p>
        <h2 className="section-title mt-1">สร้างบัญชีและกำหนดสิทธิ์</h2>
        <p className="section-description mt-1">ผู้ใช้เข้าสู่ระบบด้วยอีเมลนี้ + รหัสผ่านชั่วคราวที่ระบบสร้างให้</p>
      </div>

      <label className="field-label">
        อีเมล
        <input className="field-input" name="email" type="email" required placeholder="name@company.com" />
      </label>
      <label className="field-label">
        ชื่อ-นามสกุล
        <input className="field-input" name="fullName" required placeholder="ชื่อ-นามสกุล" />
      </label>

      <fieldset className="grid gap-2">
        <span className="field-label mb-0">ประเภทผู้ใช้</span>
        <label className={`flex cursor-pointer items-start gap-2.5 rounded-card border p-3 ${kind === "staff" ? "border-operation bg-operation-soft" : "border-border"}`}>
          <input type="radio" name="kind" className="mt-0.5" checked={kind === "staff"} onChange={() => setKind("staff")} />
          <span>
            <span className="block text-[13px] font-semibold text-ink">เจ้าหน้าที่โครงการ</span>
            <span className="block text-[12px] text-ink-faint">เห็นเฉพาะโครงการที่ได้รับมอบหมาย</span>
          </span>
        </label>
        <label className={`flex cursor-pointer items-start gap-2.5 rounded-card border p-3 ${kind === "admin" ? "border-operation bg-operation-soft" : "border-border"}`}>
          <input type="radio" name="kind" className="mt-0.5" checked={kind === "admin"} onChange={() => setKind("admin")} />
          <span>
            <span className="block text-[13px] font-semibold text-ink">ผู้ดูแลแพลตฟอร์ม</span>
            <span className="block text-[12px] text-ink-faint">เห็นทุกโครงการ จัดการผู้ใช้ สร้างโครงการใหม่</span>
          </span>
        </label>
      </fieldset>

      {kind === "staff" ? (
        <div className="grid gap-3 rounded-card border border-border bg-canvas/40 p-3">
          <label className="field-label">
            โครงการ
            <select className="field-input" name="projectId" required defaultValue="">
              <option value="" disabled>
                เลือกโครงการ
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-1.5">
            <span className="field-label mb-0">บทบาทในโครงการ</span>
            {PROJECT_ROLES.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-start gap-2.5 rounded-card border p-2.5 ${projectRole === r ? "border-operation bg-operation-soft" : "border-border bg-white"}`}
              >
                <input type="radio" name="projectRoleKey" className="mt-0.5" checked={projectRole === r} onChange={() => setProjectRole(r)} />
                <span>
                  <span className="block text-[13px] font-semibold text-ink">{roleLabelTh(r)}</span>
                  <span className="block text-[12px] text-ink-faint">{PROJECT_ROLE_HINT[r]}</span>
                </span>
              </label>
            ))}
          </div>
          {!projects.length ? <p className="text-[12px] text-rose-600">ยังไม่มีโครงการ สร้างโครงการก่อนเพิ่มเจ้าหน้าที่</p> : null}
        </div>
      ) : null}

      <ActionFeedback message={message} tone={tone} />
      <button
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-panel bg-operation px-5 text-sm font-semibold text-white transition hover:bg-operation-deep disabled:bg-slate-300"
        disabled={isPending}
        type="submit"
      >
        <UserPlus className="h-4 w-4" />
        {isPending ? "กำลังเพิ่ม..." : "เพิ่มผู้ใช้"}
      </button>
    </form>
  );
}
