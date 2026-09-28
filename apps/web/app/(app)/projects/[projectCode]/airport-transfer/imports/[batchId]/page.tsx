import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ImportBatchView } from "@/components/airport-transfer/import/batch-view";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getImportBatch } from "@/lib/airport-transfer/import/batch";
import { getProjectByCode } from "@/lib/data/projects";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

// A re-check looks flights up again; an import writes one case per row.
export const maxDuration = 60;

const stamp = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });

export default async function AirportTransferImportBatchPage({ params }: { params: Promise<{ projectCode: string; batchId: string }> }) {
  const { projectCode, batchId } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const supabase = getSupabaseServerDataClient();
  const loaded = supabase ? await getImportBatch(supabase, batchId, project.id) : null;
  if (!loaded) notFound();
  const access = await getAirportTransferAccess(project.id);
  const { batch, rows } = loaded;

  return (
    <>
      <header className="grid gap-1">
        <Link href={`/projects/${projectCode}/airport-transfer/imports`} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-slate-500 hover:text-cyan-800">
          <ArrowLeft className="h-4 w-4" /> ไฟล์ที่อัปโหลด
        </Link>
        <h1 className="text-2xl font-semibold">{batch.fileName}</h1>
        <p className="text-sm text-slate-500">
          {batch.meta.clientName ? `${batch.meta.clientName} · ` : ""}
          {batch.meta.isTemplate ? "แบบฟอร์มของระบบ" : `ไฟล์ของลูกค้า (ชีต ${batch.meta.sheetName})`}
          {batch.meta.checkedAt ? ` · ตรวจล่าสุด ${stamp.format(new Date(batch.meta.checkedAt))}` : ""}
        </p>
      </header>
      {access.canManage ? (
        <ImportBatchView projectId={project.id} projectCode={projectCode} batch={batch} rows={rows} />
      ) : (
        <p className="text-sm text-slate-500">ดูได้อย่างเดียว — นำเข้าได้เฉพาะผู้ดูแลหรือผู้จัดรถของโครงการ</p>
      )}
    </>
  );
}
