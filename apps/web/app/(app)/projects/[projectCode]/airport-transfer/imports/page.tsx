import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { ImportSteps } from "@/components/airport-transfer/import/import-steps";
import { ImportUploadForm } from "@/components/airport-transfer/import/upload-form";
import { FieldHelp } from "@/components/ui/field-help";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { listImportBatches, type ImportBatch } from "@/lib/airport-transfer/import/batch";
import { getProjectByCode } from "@/lib/data/projects";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

// Long enough for an upload that checks a few dozen flights on the way in.
export const maxDuration = 60;

const BATCH_STATUS: Record<ImportBatch["status"], string> = {
  uploaded: "รอจับคู่คอลัมน์",
  validating: "กำลังตรวจ",
  ready: "ตรวจแล้ว รอนำเข้า",
  imported: "นำเข้าแล้ว",
  failed: "ผิดพลาด",
  cancelled: "ยกเลิก"
};

const stamp = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });

export default async function AirportTransferImportsPage({ params }: { params: Promise<{ projectCode: string }> }) {
  const { projectCode } = await params;
  const project = await getProjectByCode(projectCode);
  if (!project) notFound();
  const access = await getAirportTransferAccess(project.id);
  const supabase = getSupabaseServerDataClient();
  const batches = supabase ? await listImportBatches(supabase, project.id) : [];
  const base = `/projects/${projectCode}/airport-transfer/imports`;

  const waiting = batches.filter((batch) => batch.status === "ready" || batch.status === "uploaded").length;

  return (
    <>
      <PageHeader eyebrow="Airport Transfer" title="นำเข้าข้อมูลจาก Excel" />
      <ImportSteps current={waiting ? 3 : 2} />

      {/* Step 1, one slim row: the form to send the customer, in either language. */}
      <section className="enterprise-panel flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-operation" />
          <h2 className="text-sm font-semibold text-ink">1. แบบฟอร์มสำหรับลูกค้า</h2>
          <FieldHelp content="หนึ่งแถวต่อผู้โดยสารหนึ่งเที่ยว ลูกค้าเลือกขาเดินทาง วันที่ (เฉพาะวันในช่วงงาน) และค่าอื่นจากรายการ แล้วพิมพ์เลขเที่ยวบิน ชื่อ และโรงแรม — เวลาเครื่องและสนามบินระบบดึงให้เอง · มีชีตวิธีกรอก" />
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`${base}/template`} className="inline-flex items-center gap-1.5 rounded-command border border-operation/40 bg-operation-soft px-3 py-1.5 text-[13px] font-semibold text-operation hover:bg-white">
            <Download className="h-4 w-4" /> ภาษาไทย (.xlsx)
          </a>
          <a href={`${base}/template?lang=en`} className="inline-flex items-center gap-1.5 rounded-command border border-operation/40 bg-operation-soft px-3 py-1.5 text-[13px] font-semibold text-operation hover:bg-white">
            <Download className="h-4 w-4" /> English (.xlsx)
          </a>
        </div>
      </section>

      {/* Steps 2–4 in one card: upload, and the files right under it, each one
          opening on its check page (fix rows, then confirm). */}
      <section className="enterprise-panel grid gap-4 p-4">
        {access.canManage ? (
          <ImportUploadForm projectId={project.id} projectCode={projectCode} />
        ) : (
          <p className="text-sm text-slate-500">นำเข้าได้เฉพาะผู้ดูแลหรือผู้จัดรถของโครงการ</p>
        )}
        <div className="grid gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold text-ink">3–5. ตรวจ เติมข้อมูล และนำเข้า</h2>
          <FieldHelp content="ระบบตรวจทุกแถว: ข้อมูลครบและรูปแบบถูก · เที่ยวบินมีจริงในวันนั้นและลง/ออกสนามบินในไทยตามขาเดินทาง · ไม่ซ้ำกับเคสที่มีหรือแถวอื่นในไฟล์ — ไม่มีอะไรเข้าระบบจนกว่าจะกดยืนยันนำเข้า" />
          <span className="text-xs text-ink-soft">— กดชื่อไฟล์เพื่อเปิด</span>
        </div>
        {batches.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">ไฟล์</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2">แถว</th>
                  <th className="px-3 py-2">ผ่าน / ข้อสังเกต / ต้องแก้</th>
                  <th className="px-3 py-2">นำเข้าแล้ว</th>
                  <th className="px-3 py-2">อัปโหลดเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <Link href={`${base}/${batch.id}`} className="font-semibold text-cyan-800 underline">
                        {batch.fileName}
                      </Link>
                      {batch.meta.clientName ? <span className="block text-xs text-slate-500">{batch.meta.clientName}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{BATCH_STATUS[batch.status]}</td>
                    <td className="px-3 py-2 tabular-nums">{batch.totalRows}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      <span className="text-emerald-700">{batch.validRows}</span> / <span className="text-amber-700">{batch.warningRows}</span> /{" "}
                      <span className="text-rose-700">{batch.errorRows}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{batch.meta.importedCount ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{stamp.format(new Date(batch.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">ยังไม่มีไฟล์ที่อัปโหลด</p>
        )}
        </div>
      </section>
    </>
  );
}
