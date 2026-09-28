"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { uploadAirportTransferImport, type ImportActionState } from "@/app/airport-transfer/import-actions";

const initial: ImportActionState = { ok: false, message: "" };

export function ImportUploadForm({ projectId, projectCode }: { projectId: string; projectCode: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadAirportTransferImport.bind(null, projectId), initial);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (state.ok && state.batchId) router.push(`/projects/${projectCode}/airport-transfer/imports/${state.batchId}`);
  }, [projectCode, router, state]);

  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-cyan-800" />
        <h2 className="font-semibold">อัปโหลดไฟล์ที่ลูกค้ากรอกมา</h2>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-300 bg-cyan-50/40 px-4 py-6 text-center hover:border-cyan-500">
        <FileSpreadsheet className="h-7 w-7 text-cyan-800" />
        <span className="text-sm font-semibold text-slate-700">{fileName || "เลือกไฟล์ .xlsx"}</span>
        <span className="text-xs text-slate-500">แบบฟอร์มของเรา หรือไฟล์ของลูกค้าเองก็ได้ · ไม่เกิน 5 MB · 500 แถว</span>
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          required
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-slate-700">ชื่อลูกค้า / บริษัท (ถ้ามี)</span>
        <input name="clientName" className="h-10 rounded-xl border border-slate-300 px-3" placeholder="ใช้กับทุกเคสในไฟล์นี้" />
      </label>
      {state.message && !state.ok ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.message}</p> : null}
      <button
        type="submit"
        disabled={pending || !fileName}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "กำลังอ่านและตรวจ… (อาจใช้เวลาถ้ามีหลายเที่ยวบิน)" : "อัปโหลดและตรวจ"}
      </button>
    </form>
  );
}
