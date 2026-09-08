"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameProjectAction } from "@/app/actions/projects";

export function ProjectRenameForm({ projectId, currentName }: { projectId: string; currentName: string }) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (name.trim() === currentName.trim() || name.trim().length < 2) return;
    setMsg(null);
    startTransition(async () => {
      const result = await renameProjectAction({ projectId, projectName: name });
      if (result.success) {
        setMsg({ tone: "ok", text: "บันทึกชื่อใหม่แล้ว" });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error || "บันทึกไม่สำเร็จ" });
      }
    });
  }

  return (
    <div className="grid gap-2">
      <label className="text-xs font-semibold text-slate-600">ชื่อโครงการ</label>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending || name.trim() === currentName.trim() || name.trim().length < 2}
          className="rounded-xl bg-operation px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
      {msg ? <p className={`text-xs font-semibold ${msg.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p> : null}
    </div>
  );
}
