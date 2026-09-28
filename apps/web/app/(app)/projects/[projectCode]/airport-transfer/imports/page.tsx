import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { ImportUploadForm } from "@/components/airport-transfer/import/upload-form";
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

  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Import Center</p>
        <h1 className="mt-1 text-2xl font-semibold">นำเข้าข้อมูลจาก Excel</h1>
      </header>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-cyan-800" />
            <h2 className="font-semibold">1. ส่งแบบฟอร์มให้ลูกค้ากรอก</h2>
          </div>
          <p className="text-sm text-slate-600">
            หนึ่งแถวต่อผู้โดยสารหนึ่งเที่ยว ลูกค้าใส่แค่ขาเดินทาง วันที่ เลขเที่ยวบิน ชื่อ และโรงแรม — เวลาเครื่องและสนามบินระบบดึงให้เอง
          </p>
          <ul className="grid gap-1 text-xs text-slate-500">
            <li>· มีตัวเลือกให้กด ช่องที่ต้องกรอกเป็นสีเหลือง และมีแถวตัวอย่าง</li>
            <li>· มีชีต “วิธีกรอก” อธิบายทุกคอลัมน์ (ไทย/อังกฤษ)</li>
          </ul>
          <a
            href={`${base}/template`}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50"
          >
            <Download className="h-4 w-4" /> ดาวน์โหลดแบบฟอร์ม (.xlsx)
          </a>
        </div>

        {access.canManage ? (
          <ImportUploadForm projectId={project.id} projectCode={projectCode} />
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">นำเข้าได้เฉพาะผู้ดูแลหรือผู้จัดรถของโครงการ</p>
        )}
      </section>

      <aside className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-800" />
        <span>
          ระบบตรวจทุกแถวก่อน: ข้อมูลครบและรูปแบบถูก · เที่ยวบินมีจริงในวันนั้นและลง/ออกสนามบินในไทยตามขาเดินทาง · ไม่ซ้ำกับเคสที่มีอยู่หรือแถวอื่นในไฟล์ — ไม่มีอะไรเข้าระบบจนกว่าจะกด “ยืนยันนำเข้า”
        </span>
      </aside>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">ไฟล์ที่อัปโหลด</h2>
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
      </section>
    </>
  );
}
