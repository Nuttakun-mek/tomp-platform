"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { cancelAssignmentAction } from "@/app/actions/assignments";
import { useToast } from "@/components/ui/toast";

export function CancelAssignmentButton({ projectId, assignmentId }: { projectId: string; assignmentId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function cancelTask() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    startTransition(async () => {
      const result = await cancelAssignmentAction({
        projectId,
        assignmentId,
        reason: "ผู้ใช้ถอนงานจากหน้าจัดการรถ"
      });
      if (!result.success) {
        toast.error(result.error || "ถอนงานไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "ถอนงานสำเร็จ");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <button
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          confirming ? "border-red-600 bg-red-600 text-white hover:bg-red-700" : "border-red-200 bg-white text-red-700 hover:bg-red-50"
        }`}
        disabled={isPending}
        onClick={cancelTask}
        onBlur={() => setConfirming(false)}
        type="button"
      >
        <XCircle className="h-4 w-4" />
        {isPending ? "กำลังถอนงาน..." : confirming ? "กดยืนยันอีกครั้งเพื่อถอนงาน" : "ถอนงาน"}
      </button>
      {confirming ? <p className="text-xs text-red-600">งานจะเปลี่ยนสถานะเป็นยกเลิกและบันทึก Timeline (ไม่ถูกลบ)</p> : null}
    </div>
  );
}
