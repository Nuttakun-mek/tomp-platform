"use client";

import { useState, useTransition } from "react";
import { XCircle } from "lucide-react";
import { cancelAssignmentAction } from "@/app/actions/assignments";
import { ActionFeedback } from "@/components/ui/action-feedback";

export function CancelAssignmentButton({ projectId, assignmentId }: { projectId: string; assignmentId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger" | "warning">("warning");
  const [isPending, startTransition] = useTransition();

  function cancelTask() {
    const confirmed = window.confirm("ยืนยันถอนงานนี้หรือไม่ งานจะไม่ถูกลบ แต่จะเปลี่ยนสถานะเป็นยกเลิกและบันทึก Timeline");
    if (!confirmed) return;
    setMessage("กำลังถอนงาน...");
    setTone("warning");
    startTransition(async () => {
      const result = await cancelAssignmentAction({
        projectId,
        assignmentId,
        reason: "ผู้ใช้ถอนงานจากหน้าจัดการรถ"
      });
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "ถอนงานไม่สำเร็จ");
        return;
      }
      setTone("success");
      setMessage(result.warning || "ถอนงานสำเร็จ ระบบบันทึก Timeline แล้ว");
      window.setTimeout(() => window.location.reload(), 900);
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
        disabled={isPending}
        onClick={cancelTask}
        type="button"
      >
        <XCircle className="h-4 w-4" />
        {isPending ? "กำลังถอนงาน..." : "ถอนงาน"}
      </button>
      <ActionFeedback message={message} tone={tone} />
    </div>
  );
}
