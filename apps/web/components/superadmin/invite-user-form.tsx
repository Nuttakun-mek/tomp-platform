"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Info, UserPlus } from "lucide-react";
import { provisionUserAction } from "@/app/actions/superadmin-users";
import { ActionFeedback } from "@/components/ui/action-feedback";

interface Option {
  id: string;
  label: string;
}

// "staff_notice" isn't a submittable radio — it's the non-interactive card
// that replaced the old project-scoped "staff" option (see below). Only
// "project_manager" and "admin" are ever set as state.
type Kind = "staff_notice" | "project_manager" | "admin";

export function InviteUserForm({ organizations }: { organizations: Option[] }) {
  const orgId = organizations[0]?.id ?? "";
  const [kind, setKind] = useState<Exclude<Kind, "staff_notice">>("project_manager");
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
        globalRoleKey: kind === "admin" ? "super_admin" : "project_manager"
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

        <div className="flex items-start gap-2.5 rounded-card border border-blue-200 bg-blue-50 p-3 text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-[12.5px] leading-5">
            ต้องการเพิ่มคนเข้าทำงานในโครงการที่มีอยู่แล้ว (ไม่ใช่สร้างโครงการเอง)? ไปที่หน้า{" "}
            <Link href="/projects" className="font-semibold underline underline-offset-2">
              ตั้งค่า
            </Link>{" "}
            ของโครงการนั้นแทน
          </span>
        </div>

        <label
          className={`flex cursor-pointer items-start gap-2.5 rounded-card border p-3 ${kind === "project_manager" ? "border-operation bg-operation-soft" : "border-border"}`}
        >
          <input
            type="radio"
            name="kind"
            className="mt-0.5"
            checked={kind === "project_manager"}
            onChange={() => setKind("project_manager")}
          />
          <span>
            <span className="block text-[13px] font-semibold text-ink">ผู้จัดการโครงการ (สร้างโครงการเองได้)</span>
            <span className="block text-[12px] text-ink-faint">สร้างโครงการใหม่ได้เอง และเป็นผู้จัดการโครงการนั้นโดยอัตโนมัติ — เห็นเฉพาะโครงการของตัวเอง</span>
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
