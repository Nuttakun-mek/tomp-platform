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
    <form action={action} className="grid gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Upload className="h-4 w-4 text-operation" /> 2. อัปโหลดไฟล์ที่ลูกค้ากรอกมา
      </h2>
      <div className="grid items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_16rem_auto]">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-operation/40 bg-operation-soft/40 px-3 py-2 hover:border-operation">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-operation" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{fileName || "เลือกไฟล์ .xlsx"}</span>
            <span className="block text-[11px] text-ink-faint">แบบฟอร์มของเรา (ไทย/อังกฤษ) หรือไฟล์ของลูกค้าเอง · ไม่เกิน 5 MB · 500 แถว</span>
          </span>
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            required
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          />
        </label>
        <input name="clientName" className="field-input" placeholder="ชื่อลูกค้า / บริษัท (ถ้ามี)" aria-label="ชื่อลูกค้า / บริษัท" />
        <button
          type="submit"
          disabled={pending || !fileName}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-operation px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {pending ? "กำลังอ่านและตรวจ…" : "อัปโหลดและตรวจ"}
        </button>
      </div>
      {state.message && !state.ok ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.message}</p> : null}
    </form>
  );
}
