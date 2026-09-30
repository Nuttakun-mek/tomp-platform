"use server";

import { revalidatePath } from "next/cache";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { cancelImportBatch, checkImportBatch, commitImportBatch, createImportBatch, getImportBatch, saveBatchMapping, updateImportRowValues } from "@/lib/airport-transfer/import/batch";
import type { ImportField } from "@/lib/airport-transfer/import/columns";
import type { ColumnMapping } from "@/lib/airport-transfer/import/normalize";
import { readImportWorkbook } from "@/lib/airport-transfer/import/workbook";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

export interface ImportActionState {
  ok: boolean;
  message: string;
  batchId?: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function guard(projectId: string) {
  const access = await getAirportTransferAccess(projectId);
  if (!access.allowed || !access.canManage) return { error: "บัญชีนี้ไม่มีสิทธิ์นำเข้าข้อมูลในโครงการนี้" } as const;
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return { error: "ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล" } as const;
  return { supabase, access } as const;
}

function revalidate() {
  revalidatePath("/projects/[projectCode]/airport-transfer", "layout");
}

export async function uploadAirportTransferImport(projectId: string, _previous: ImportActionState, formData: FormData): Promise<ImportActionState> {
  const gate = await guard(projectId);
  if ("error" in gate) return { ok: false, message: gate.error! };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { ok: false, message: "เลือกไฟล์ Excel ก่อน" };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, message: "รองรับเฉพาะไฟล์ .xlsx (ถ้าเป็น .xls หรือ .csv ให้เปิดใน Excel แล้วบันทึกเป็น .xlsx)" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: "ไฟล์ใหญ่เกิน 5 MB" };

  let workbook;
  try {
    workbook = await readImportWorkbook(await file.arrayBuffer());
  } catch (error) {
    return { ok: false, message: `อ่านไฟล์ไม่ได้: ${error instanceof Error ? error.message : "รูปแบบไฟล์ไม่ถูกต้อง"}` };
  }
  if (!workbook.rows.length) return { ok: false, message: "ไม่พบข้อมูลในไฟล์ (แถวตัวอย่างไม่นับ)" };

  const profile = await getCurrentUserProfile();
  const clientName = String(formData.get("clientName") || "").trim() || null;
  const created = await createImportBatch(gate.supabase, { projectId, fileName: file.name, clientName, createdBy: profile.id, workbook });
  if (!created.ok) return { ok: false, message: `บันทึกไฟล์ไม่สำเร็จ: ${created.message}` };

  // A file whose columns are all recognised is checked straight away; any
  // other file stops at the column-matching step first.
  const checked = await checkImportBatch(gate.supabase, created.batchId, projectId, bangkokToday());
  revalidate();
  return {
    ok: true,
    batchId: created.batchId,
    message: checked.ok ? `อ่าน ${workbook.rows.length} แถวและตรวจแล้ว` : `อ่าน ${workbook.rows.length} แถว — ${checked.message}`
  };
}

export async function saveAirportTransferImportMapping(projectId: string, batchId: string, mapping: ColumnMapping): Promise<ImportActionState> {
  const gate = await guard(projectId);
  if ("error" in gate) return { ok: false, message: gate.error! };
  const loaded = await getImportBatch(gate.supabase, batchId, projectId);
  if (!loaded) return { ok: false, message: "ไม่พบชุดนำเข้า" };
  await saveBatchMapping(gate.supabase, loaded.batch, mapping);
  const checked = await checkImportBatch(gate.supabase, batchId, projectId, bangkokToday());
  revalidate();
  return checked.ok ? { ok: true, message: "บันทึกการจับคู่และตรวจแล้ว" } : { ok: false, message: checked.message };
}

export async function recheckAirportTransferImport(projectId: string, batchId: string): Promise<ImportActionState> {
  const gate = await guard(projectId);
  if ("error" in gate) return { ok: false, message: gate.error! };
  const checked = await checkImportBatch(gate.supabase, batchId, projectId, bangkokToday());
  revalidate();
  if (!checked.ok) return { ok: false, message: checked.message };
  return {
    ok: true,
    message: checked.remaining
      ? `ตรวจแล้ว — ยังเหลือเที่ยวบินที่ยังไม่ได้ตรวจ ${checked.remaining} รายการ กดตรวจอีกครั้งเพื่อตรวจต่อ`
      : "ตรวจแล้ว"
  };
}

export async function commitAirportTransferImport(projectId: string, batchId: string, includeWarnings: boolean): Promise<ImportActionState> {
  const gate = await guard(projectId);
  if ("error" in gate) return { ok: false, message: gate.error! };
  const profile = await getCurrentUserProfile();
  const result = await commitImportBatch(gate.supabase, { batchId, projectId, organizationId: profile.organizationId, profileId: profile.id, includeWarnings });
  revalidate();
  if (!result.ok) return { ok: false, message: result.message };
  const parts = [`นำเข้า ${result.imported} เคสแล้ว`];
  if (result.left > 0) parts.push(`เหลือ ${result.left} แถวในชุดนี้ให้แก้และตรวจอีกครั้ง`);
  if (result.failures.length) parts.push(`ไม่สำเร็จ ${result.failures.length} แถว: ${result.failures.slice(0, 3).join(" · ")}`);
  return { ok: result.failures.length === 0, message: parts.join(" — ") };
}

export async function cancelAirportTransferImport(projectId: string, batchId: string): Promise<ImportActionState> {
  const gate = await guard(projectId);
  if ("error" in gate) return { ok: false, message: gate.error! };
  const result = await cancelImportBatch(gate.supabase, batchId, projectId);
  revalidate();
  return result.ok ? { ok: true, message: "ยกเลิกชุดนี้แล้ว ไม่มีข้อมูลใดถูกนำเข้าเพิ่ม" } : { ok: false, message: result.message };
}

export async function fixAirportTransferImportRow(
  projectId: string,
  batchId: string,
  rowId: string,
  values: Partial<Record<ImportField, string>>
): Promise<ImportActionState> {
  const gate = await guard(projectId);
  if ("error" in gate) return { ok: false, message: gate.error! };
  const updated = await updateImportRowValues(gate.supabase, { batchId, projectId, rowId, values });
  if (!updated.ok) return { ok: false, message: updated.message };
  const checked = await checkImportBatch(gate.supabase, batchId, projectId, bangkokToday());
  revalidate();
  return checked.ok ? { ok: true, message: "บันทึกและตรวจแถวนี้ใหม่แล้ว" } : { ok: false, message: checked.message };
}
