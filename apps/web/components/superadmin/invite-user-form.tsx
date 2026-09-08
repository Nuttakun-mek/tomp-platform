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

// Single-org: the only global role is platform admin. Everyone else is added to
// specific projects with a per-project role.
const GLOBAL_ROLES = ["super_admin"];
const PROJECT_ROLES = ["project_manager", "dispatcher", "coordinator", "customer_viewer"];

export function InviteUserForm({ organizations, projects }: { organizations: Option[]; projects: Option[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("danger");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await provisionUserAction({
        email: formData.get("email"),
        fullName: formData.get("fullName"),
        organizationId: formData.get("organizationId"),
        globalRoleKey: formData.get("globalRoleKey") || undefined,
        projectId: formData.get("projectId") || undefined,
        projectRoleKey: formData.get("projectRoleKey") || undefined
      });
      if (result.success) {
        setTone("success");
        const temp =
          result.data && typeof result.data === "object" && "tempPassword" in result.data
            ? String(result.data.tempPassword)
            : null;
        setMessage(
          temp
            ? `เพิ่มผู้ใช้แล้ว — ส่งรหัสผ่านชั่วคราวนี้ให้ผู้ใช้อย่างปลอดภัย แล้วให้เปลี่ยนหลังเข้าระบบครั้งแรก: ${temp}`
            : "เพิ่มผู้ใช้แล้ว — ให้ผู้ใช้เข้าสู่ระบบด้วยอีเมลนี้เพื่อเปิดใช้งานบัญชี"
        );
      } else {
        setTone("danger");
        setMessage(result.error || "เพิ่มผู้ใช้ไม่สำเร็จ");
      }
    });
  }

  return (
    <form action={submit} className="enterprise-panel grid content-start gap-4 p-5">
      <div>
        <p className="section-label">เพิ่มผู้ใช้</p>
        <h2 className="section-title mt-1">เตรียมบัญชีและกำหนดบทบาท</h2>
        <p className="section-description mt-1">
          ระบบจะสร้างข้อมูลผู้ใช้ไว้ล่วงหน้า ผู้ใช้เข้าสู่ระบบด้วยอีเมลเดียวกันแล้วบัญชีจะผูกอัตโนมัติ
        </p>
      </div>
      <label className="field-label">
        อีเมล
        <input className="field-input" name="email" type="email" required placeholder="name@company.com" />
      </label>
      <label className="field-label">
        ชื่อผู้ใช้
        <input className="field-input" name="fullName" required placeholder="ชื่อ-นามสกุล" />
      </label>
      <label className="field-label">
        องค์กร
        <select className="field-input" name="organizationId" required>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        บทบาทระดับองค์กร (ไม่บังคับ)
        <select className="field-input" name="globalRoleKey" defaultValue="">
          <option value="">— ไม่กำหนด —</option>
          {GLOBAL_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabelTh(r)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          โครงการ (ไม่บังคับ)
          <select className="field-input" name="projectId" defaultValue="">
            <option value="">— ไม่กำหนด —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          บทบาทในโครงการ
          <select className="field-input" name="projectRoleKey" defaultValue="">
            <option value="">— ไม่กำหนด —</option>
            {PROJECT_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabelTh(r)}
              </option>
            ))}
          </select>
        </label>
      </div>
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
