"use client";

import { useMemo, useState, useTransition } from "react";
import { addProjectMemberAction, issueProjectHelperAction } from "@/app/actions/project-members";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { useToast } from "@/components/ui/toast";
import { SYSTEM_ROLE_ALLOWLIST } from "@/lib/auth/system-roles";
import { roleLabelTh } from "@/lib/i18n/role-th";

const SYSTEM_LABEL: Record<string, string> = { ground_transfer: "Ground Transfer", airport_transfer: "Airport Transfer" };

// The options offered here are the SAME allowlist the server actions enforce
// (lib/auth/system-roles.ts) — imported, not duplicated, so this list can
// never drift out of sync with what the server will actually accept.
function RoleSelect({ systemKey, name, defaultValue }: { systemKey: string; name: string; defaultValue?: string }) {
  const options = SYSTEM_ROLE_ALLOWLIST[systemKey] ?? [];
  return (
    <select className="field-input" name={name} defaultValue={defaultValue ?? options[0] ?? ""}>
      {options.map((role) => (
        <option key={role} value={role}>
          {roleLabelTh(role)}
        </option>
      ))}
    </select>
  );
}

export function AddProjectMemberForm({ projectId, enabledSystems }: { projectId: string; enabledSystems: string[] }) {
  const systems = useMemo(() => (enabledSystems.length ? enabledSystems : ["ground_transfer"]), [enabledSystems]);

  return (
    <div className="grid gap-2">
      <FullAccountSection projectId={projectId} systems={systems} />
      <ProjectHelperSection projectId={projectId} systems={systems} />
    </div>
  );
}

function FullAccountSection({ projectId, systems }: { projectId: string; systems: string[] }) {
  const toast = useToast();
  const [systemKey, setSystemKey] = useState(systems[0]);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setFeedback(null);
    const email = String(formData.get("email") || "").trim();
    const fullName = String(formData.get("fullName") || "").trim();
    const roleKey = String(formData.get("roleKey") || "");

    if (!email) {
      toast.warning("กรอกอีเมลก่อนเพิ่มสมาชิก");
      return;
    }

    startTransition(async () => {
      const result = await addProjectMemberAction({ projectId, systemKey, roleKey, email, fullName: fullName || undefined });
      if (!result.success) {
        setFeedback({ tone: "danger", message: result.error || "เพิ่มสมาชิกไม่สำเร็จ" });
        return;
      }
      const tempPassword = result.data?.tempPassword;
      setFeedback({
        tone: "success",
        message: tempPassword
          ? `สร้างบัญชีและเพิ่มสมาชิกแล้ว — ส่งอีเมลและรหัสผ่านชั่วคราวนี้ให้ผู้ใช้ (ให้เปลี่ยนหลังเข้าครั้งแรก): ${tempPassword}`
          : "เพิ่มสมาชิกในโครงการแล้ว"
      });
      toast.success("เพิ่มสมาชิกแล้ว");
    });
  }

  return (
    <CollapsibleSection title="เพิ่มสมาชิกแบบมีบัญชี" description="ผู้ใช้ที่มีอีเมล เข้าสู่ระบบด้วยบัญชีของตัวเอง" defaultOpen={false} storageKey={`add-member.full.${projectId}`}>
      <form action={submit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            ระบบ
            <select className="field-input" value={systemKey} onChange={(event) => setSystemKey(event.target.value)}>
              {systems.map((key) => (
                <option key={key} value={key}>
                  {SYSTEM_LABEL[key] ?? key}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            บทบาท
            <RoleSelect key={systemKey} systemKey={systemKey} name="roleKey" />
          </label>
        </div>
        <label className="field-label">
          อีเมล
          <input className="field-input" name="email" type="email" required placeholder="name@company.com" />
        </label>
        <label className="field-label">
          ชื่อ-นามสกุล <span className="font-normal text-slate-400">(กรอกเมื่อยังไม่มีบัญชีในระบบ)</span>
          <input className="field-input" name="fullName" placeholder="ใช้ตอนสร้างบัญชีใหม่เท่านั้น" />
        </label>
        <ActionFeedback message={feedback?.message} tone={feedback?.tone} />
        <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
          {isPending ? "กำลังเพิ่ม..." : "เพิ่มสมาชิก"}
        </button>
      </form>
    </CollapsibleSection>
  );
}

function ProjectHelperSection({ projectId, systems }: { projectId: string; systems: string[] }) {
  const toast = useToast();
  const [systemKey, setSystemKey] = useState(systems[0]);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [helperUrl, setHelperUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setFeedback(null);
    setHelperUrl(null);
    const fullName = String(formData.get("fullName") || "").trim();
    const pin = String(formData.get("pin") || "").trim();
    const roleKey = String(formData.get("roleKey") || "");
    const nickname = String(formData.get("nickname") || "").trim();
    const phone = String(formData.get("phone") || "").trim();

    if (!fullName) {
      toast.warning("กรอกชื่อก่อนออกลิงก์");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast.warning("รหัส PIN ต้องเป็นตัวเลข 4-6 หลัก");
      return;
    }

    startTransition(async () => {
      const result = await issueProjectHelperAction({ projectId, systemKey, roleKey, fullName, nickname: nickname || undefined, phone: phone || undefined, pin });
      if (!result.success) {
        setFeedback({ tone: "danger", message: result.error || "ออกลิงก์ไม่สำเร็จ" });
        return;
      }
      setHelperUrl(result.data?.helperUrl ?? null);
      setFeedback({ tone: "success", message: `ออกลิงก์แล้ว — แจ้งรหัส PIN “${pin}” แยกจากลิงก์นี้` });
      toast.success("ออกลิงก์ผู้ช่วยงานแล้ว");
    });
  }

  return (
    <CollapsibleSection
      title="ออกลิงก์ผู้ช่วยงาน (QR/PIN)"
      description="สำหรับผู้ที่ทำงานในโครงการนี้โครงการเดียว และไม่มีอีเมล — เช่น เจ้าหน้าที่ประสานงานสนามบิน"
      defaultOpen={false}
      storageKey={`add-member.helper.${projectId}`}
    >
      <form action={submit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            ระบบ
            <select className="field-input" value={systemKey} onChange={(event) => setSystemKey(event.target.value)}>
              {systems.map((key) => (
                <option key={key} value={key}>
                  {SYSTEM_LABEL[key] ?? key}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            บทบาท
            <RoleSelect key={systemKey} systemKey={systemKey} name="roleKey" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            ชื่อ-นามสกุล
            <input className="field-input" name="fullName" required placeholder="เช่น สมชาย ใจดี" />
          </label>
          <label className="field-label">
            ชื่อเล่น <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
            <input className="field-input" name="nickname" placeholder="ใช้เรียกทางวิทยุ" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            เบอร์โทรศัพท์ <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
            <input className="field-input" name="phone" inputMode="tel" placeholder="08x-xxx-xxxx" />
          </label>
          <label className="field-label">
            รหัส PIN (4-6 หลัก)
            <input className="field-input" name="pin" inputMode="numeric" maxLength={6} required placeholder="เช่น 1234" />
          </label>
        </div>
        <ActionFeedback message={feedback?.message} tone={feedback?.tone} />
        {helperUrl ? (
          <p className="break-all rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">{helperUrl}</p>
        ) : null}
        <button className="w-fit rounded-2xl bg-operation px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:bg-slate-300" disabled={isPending} type="submit">
          {isPending ? "กำลังออกลิงก์..." : "ออกลิงก์"}
        </button>
      </form>
    </CollapsibleSection>
  );
}
