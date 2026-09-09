"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCallSignSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { mapCallSign } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent } from "@/lib/timeline";

const createAutoCallSignSchema = z.object({
  projectId: z.string().uuid(),
  projectCode: z.string().trim().optional().nullable(),
  callSign: z.string().trim().max(40).optional().nullable()
});

function normalizeCallSignSeed(value?: string | null) {
  const cleaned = String(value || "UNIT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return cleaned || "UNIT";
}

export async function createCallSignAction(input: unknown): Promise<ActionResult> {
  const auto = createAutoCallSignSchema.safeParse(input);
  if (!auto.success) {
    return actionFailure("ข้อมูล Call Sign ไม่ครบถ้วน", auto.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูลจริง");
  }

  const permission = await requirePermission(auto.data.projectId, "assignment.create");
  if (!permission.allowed && mode !== "service_role") {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้าง Call Sign ในโครงการนี้");
  }

  const requestedCallSign = auto.data.callSign?.trim();
  let callSign = requestedCallSign;

  if (!callSign) {
    const seed = normalizeCallSignSeed(auto.data.projectCode);
    const { count } = await client
      .from("call_signs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", auto.data.projectId);
    callSign = `${seed}-${String((count || 0) + 1).padStart(2, "0")}`;
  }

  const parsed = createCallSignSchema.safeParse({
    projectId: auto.data.projectId,
    callSign,
    groupName: "ปฏิบัติการ",
    metadata: { source: "assignment_form", generated: !requestedCallSign }
  });

  if (!parsed.success) {
    return actionFailure("รูปแบบ Call Sign ไม่ถูกต้อง", parsed.error.flatten().fieldErrors);
  }

  const { data, error: insertError } = await client
    .from("call_signs")
    .insert({
      project_id: parsed.data.projectId,
      call_sign: parsed.data.callSign,
      group_name: parsed.data.groupName || null,
      status: "active",
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(getDatabaseErrorMessage(insertError, "สร้าง Call Sign ไม่สำเร็จ"));
  }

  const callSignRow = mapCallSign(data);
  const timelineResult = await createTimelineEvent({
    projectId: callSignRow.projectId,
    objectType: "call_sign",
    objectId: callSignRow.id,
    eventType: "CALL_SIGN_CREATED",
    source: "operation_user",
    reason: "สร้าง Call Sign สำหรับจัดงานให้คนขับ",
    afterData: data,
    metadata: { action: "create_call_sign", mode }
  });

  revalidatePath("/assignments");
  revalidatePath(`/projects/${callSignRow.projectId}`);
  revalidatePath(`/projects/${callSignRow.projectId}/assignments`);

  return actionSuccess(
    { mode, callSign: callSignRow, timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `สร้าง Call Sign แล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}
