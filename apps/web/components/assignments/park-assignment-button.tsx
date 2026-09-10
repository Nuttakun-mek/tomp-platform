"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { parkAssignmentAction } from "@/app/actions/assignments";
import { useToast } from "@/components/ui/toast";

export function ParkAssignmentButton({ projectId, assignmentId }: { projectId: string; assignmentId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function parkTask() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    startTransition(async () => {
      const result = await parkAssignmentAction({
        projectId,
        assignmentId,
        reason: "พักงานโดยศูนย์ควบคุม"
      });
      if (!result.success) {
        toast.error(result.error || "พักงานไม่สำเร็จ");
        return;
      }
      toast.success(result.warning || "พักงานสำเร็จ");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <button
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          confirming ? "border-amber-600 bg-amber-600 text-white hover:bg-amber-700" : "border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
        }`}
        disabled={isPending}
        onClick={parkTask}
        onBlur={() => setConfirming(false)}
        type="button"
      >
        <PauseCircle className="h-4 w-4" />
        {isPending ? "กำลังพักงาน..." : confirming ? "กดยืนยันอีกครั้งเพื่อพักงาน" : "พักงาน"}
      </button>
      {confirming ? <p className="text-xs text-amber-700">งานจะถูกพักไว้ชั่วคราวและบันทึก Timeline โดยไม่ลบประวัติ</p> : null}
    </div>
  );
}
