"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteProjectAction } from "@/app/actions/projects";

/**
 * Permanent deletion, kept behind typing the project code.
 *
 * Archiving hides a project and can be undone; this cannot. The confirmation is
 * deliberately not a yes/no dialog — those get dismissed by reflex. Typing the
 * code makes the operator read which project they are on, which is the mistake
 * actually worth preventing: deleting the right-looking project on the wrong tab.
 */
export function ProjectDeletePanel({
  projectId,
  projectCode,
  projectName,
  counts
}: {
  projectId: string;
  projectCode: string;
  projectName: string;
  counts: { assignments: number; missions: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matches = typed.trim() === projectCode;

  function remove() {
    if (!matches) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectAction({ projectId, confirmCode: typed.trim() });
      if (result.success) {
        router.replace("/projects");
        router.refresh();
        return;
      }
      setError(result.error || "ลบโครงการไม่สำเร็จ");
    });
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
        <div>
          <h3 className="text-sm font-bold text-rose-900">ลบโครงการถาวร</h3>
          <p className="mt-1 text-sm leading-6 text-rose-800">
            ลบ <span className="font-semibold">{projectName}</span> พร้อมงานทั้งหมด {counts.assignments} งาน ภารกิจ {counts.missions} รายการ
            QR คนขับ ประวัติ GPS และไทม์ไลน์ <span className="font-semibold">กู้คืนไม่ได้</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-rose-700">
            ถ้าแค่อยากซ่อนออกจากรายการ ใช้ “เก็บถาวร” แทน ข้อมูลจะยังอยู่ครบและกู้คืนได้
          </p>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-fit items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700"
        >
          <Trash2 className="h-4 w-4" /> ลบโครงการนี้
        </button>
      ) : (
        <div className="grid gap-2">
          <label className="text-xs font-semibold text-rose-900">
            พิมพ์รหัสโครงการ <span className="font-mono">{projectCode}</span> เพื่อยืนยัน
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-rose-300 px-3 py-2 font-mono text-sm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={projectCode}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={remove}
              disabled={!matches || isPending}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {isPending ? "กำลังลบ..." : "ลบถาวร"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
              disabled={isPending}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
            >
              ยกเลิก
            </button>
          </div>
          {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
