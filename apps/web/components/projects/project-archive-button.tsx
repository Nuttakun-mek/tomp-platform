"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import { archiveProjectAction } from "@/app/actions/projects";

export function ProjectArchiveButton({
  projectId,
  archived,
  variant = "chip"
}: {
  projectId: string;
  archived: boolean;
  variant?: "chip" | "full";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justArchived, setJustArchived] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(restore: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await archiveProjectAction({ projectId, restore });
      if (result.success) {
        setConfirming(false);
        if (!restore) {
          setJustArchived(true);
          window.setTimeout(() => setJustArchived(false), 8000);
        }
        router.refresh();
      } else {
        setError(result.error || "ทำรายการไม่สำเร็จ");
      }
    });
  }

  if (justArchived) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs">
        <span className="font-semibold text-slate-600">เก็บถาวรแล้ว</span>
        <button type="button" onClick={() => run(true)} disabled={isPending} className="font-semibold text-operation underline disabled:opacity-50">
          เลิกทำ
        </button>
      </span>
    );
  }

  if (archived) {
    return (
      <button
        type="button"
        onClick={() => run(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" /> {isPending ? "กำลังกู้คืน…" : "กู้คืนโครงการ"}
      </button>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={
          variant === "full"
            ? "inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            : "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-700"
        }
      >
        <Archive className="h-3.5 w-3.5" /> เก็บถาวร
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => run(false)}
        disabled={isPending}
        className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "กำลังเก็บ…" : "ยืนยันเก็บถาวร"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600">
        ยกเลิก
      </button>
      {error ? <span className="text-xs font-semibold text-rose-600">{error}</span> : null}
    </span>
  );
}
