import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ImportBatchView } from "@/components/airport-transfer/import/batch-view";
import { ImportSteps } from "@/components/airport-transfer/import/import-steps";
import { PageHeader } from "@/components/page-header";
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
      <Link href={`/projects/${projectCode}/airport-transfer/imports`} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-slate-500 hover:text-operation">
        <ArrowLeft className="h-4 w-4" /> ไฟล์ที่อัปโหลด
      </Link>
      <PageHeader
        eyebrow="นำเข้า Excel"
        title={batch.fileName}
        description={[
          batch.meta.clientName,
          batch.meta.isTemplate ? "แบบฟอร์มของระบบ" : `ไฟล์ของลูกค้า (ชีต ${batch.meta.sheetName})`,
          batch.meta.checkedAt ? `ตรวจล่าสุด ${stamp.format(new Date(batch.meta.checkedAt))}` : null
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <ImportSteps
        current={
          batch.status === "imported"
            ? 5
            : batch.status === "ready" && !rows.some((row) => row.status === "error" || row.status === "duplicate")
              ? 4
              : 3
        }
      />
      {access.canManage ? (
        <ImportBatchView projectId={project.id} projectCode={projectCode} batch={batch} rows={rows} />
      ) : (
        <p className="text-sm text-slate-500">ดูได้อย่างเดียว — นำเข้าได้เฉพาะผู้ดูแลหรือผู้จัดรถของโครงการ</p>
      )}
    </>
  );
}
