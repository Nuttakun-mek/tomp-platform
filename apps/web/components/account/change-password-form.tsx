"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { changeOwnPasswordAction } from "@/app/actions/account";
import { ActionFeedback } from "@/components/ui/action-feedback";

export function ChangePasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("danger");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await changeOwnPasswordAction({
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword")
      });
      if (result.success) {
        setTone("success");
        setMessage("เปลี่ยนรหัสผ่านแล้ว ใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป");
      } else {
        setTone("danger");
        setMessage(result.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
    });
  }

  return (
    <form action={submit} className="enterprise-panel grid content-start gap-4 p-4 max-w-md">
      <label className="field-label">
        รหัสผ่านใหม่
        <input className="field-input" name="newPassword" type="password" required minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" />
      </label>
      <label className="field-label">
        ยืนยันรหัสผ่านใหม่
        <input className="field-input" name="confirmPassword" type="password" required minLength={8} placeholder="พิมพ์ซ้ำอีกครั้ง" />
      </label>
      <ActionFeedback message={message} tone={tone} />
      <button
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-panel bg-operation px-5 text-sm font-semibold text-white transition hover:bg-operation-deep disabled:bg-slate-300"
        disabled={isPending}
        type="submit"
      >
        <KeyRound className="h-4 w-4" />
        {isPending ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
