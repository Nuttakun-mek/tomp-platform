"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { saveProjectContactNumbersAction } from "@/app/actions/projects";

/**
 * The numbers a driver can call from their job screen. Held on the project, so
 * a control centre types theirs once instead of once per job — and until this
 * existed there was nowhere to type them at all, which left the driver's call
 * button with nothing to dial on every real job.
 */
export function ProjectContactForm({
  projectId,
  coordinatorPhone,
  operationPhone
}: {
  projectId: string;
  coordinatorPhone: string;
  operationPhone: string;
}) {
  const router = useRouter();
  const [coordinator, setCoordinator] = useState(coordinatorPhone);
  const [operation, setOperation] = useState(operationPhone);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = coordinator.trim() !== coordinatorPhone.trim() || operation.trim() !== operationPhone.trim();

  function save() {
    if (!dirty) return;
    setMsg(null);
    startTransition(async () => {
      const result = await saveProjectContactNumbersAction({
        projectId,
        coordinatorPhone: coordinator.trim(),
        operationPhone: operation.trim()
      });
      if (result.success) {
        setMsg({ tone: "ok", text: "บันทึกเบอร์ติดต่อแล้ว คนขับจะเห็นปุ่มโทรในหน้างาน" });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error || "บันทึกไม่สำเร็จ" });
      }
    });
  }

  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Phone className="h-3.5 w-3.5" /> เบอร์ติดต่อสำหรับคนขับ
      </label>
      <p className="text-xs leading-5 text-slate-500">
        คนขับกดโทรได้จากหน้างาน ตั้งครั้งเดียวใช้ทุกงานในโครงการนี้ ถ้างานไหนมีผู้ประสานเฉพาะ ตั้งทับได้ที่งานนั้น
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold text-slate-500">ศูนย์ควบคุม</span>
          <input
            inputMode="tel"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="02-123-4567"
            value={coordinator}
            onChange={(event) => setCoordinator(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold text-slate-500">ฝ่ายปฏิบัติการ</span>
          <input
            inputMode="tel"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="02-765-4321"
            value={operation}
            onChange={(event) => setOperation(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="rounded-xl bg-operation px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "กำลังบันทึก..." : "บันทึกเบอร์ติดต่อ"}
        </button>
        {msg ? (
          <span className={`text-xs font-semibold ${msg.tone === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>
        ) : null}
      </div>
    </div>
  );
}
