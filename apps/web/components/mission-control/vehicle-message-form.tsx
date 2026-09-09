"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { sendDriverNotificationAction } from "@/app/actions/driver-notifications";
import { ActionFeedback } from "@/components/ui/action-feedback";

export function VehicleMessageForm({ projectId, assignmentId, driverId }: { projectId: string; assignmentId: string; driverId?: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("warning");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function send(formData: FormData) {
    const body = String(formData.get("body") || "").trim();
    if (!body) {
      setTone("warning");
      setMessage("กรุณาพิมพ์ข้อความก่อนส่ง");
      return;
    }

    startTransition(async () => {
      const result = await sendDriverNotificationAction({
        projectId,
        assignmentId,
        driverId,
        title: "ข้อความจากศูนย์ควบคุม",
        body,
        priority: "normal",
        actionLabel: "รับทราบ"
      });
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "ส่งข้อความไม่สำเร็จ");
        return;
      }
      setTone("success");
      setMessage("ส่งข้อความถึงคนขับแล้ว");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MessageSquare className="h-4 w-4" />
        ส่งข้อความ
      </button>
      {open ? (
        <form action={send} className="grid gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-3">
          <textarea className="min-h-20 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm" name="body" placeholder="พิมพ์ข้อความถึงคนขับ เช่น กรุณายืนยันว่าถึงจุดรับแล้ว" />
          <button className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isPending} type="submit">
            {isPending ? "กำลังส่ง..." : "ส่งถึงคนขับ"}
          </button>
        </form>
      ) : null}
      <ActionFeedback message={message} tone={tone} />
    </div>
  );
}
