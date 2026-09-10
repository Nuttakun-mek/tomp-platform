"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCallSignSchema, updateCallSignCrewSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { mapCallSign } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent } from "@/lib/timeline";

const createAutoCallSignSchema = z.object({
  projectId: z.string().uuid(),
  projectCode: z.string().trim().optional().nullable(),
  callSign: z.string().trim().max(40).optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  vehicleId: z.string().uuid().optional().nullable()
});

function normalizeCallSignSeed(value?: string | null) {
  const cleaned = String(value || "UNIT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  return cleaned || "UNIT";
}

export async function updateCallSignCrewAction(input: unknown): Promise<ActionResult> {
  const parsed = updateCallSignCrewSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูลคู่รถของ Call Sign ไม่ครบถ้วน", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูลจริง");
  }

  const permission = await requirePermission(parsed.data.projectId, "assignment.update");
  if (!permission.allowed) {
    return actionFailure(permission.reason || "ไม่มีสิทธิ์แก้ไขคู่รถของ Call Sign ในโครงการนี้");
  }

  const { data: before, error: readError } = await client
    .from("call_signs")
    .select("*")
    .eq("id", parsed.data.callSignId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();

  if (readError) return actionFailure(getDatabaseErrorMessage(readError, "อ่านข้อมูล Call Sign ไม่สำเร็จ"));
  if (!before) return actionFailure("ไม่พบ Call Sign ในโครงการนี้");

  const previousDriverId = typeof before.driver_id === "string" ? before.driver_id : null;
  const previousVehicleId = typeof before.vehicle_id === "string" ? before.vehicle_id : null;
  const nextDriverId = parsed.data.driverId || null;
  const nextVehicleId = parsed.data.vehicleId || null;

  if (previousDriverId === nextDriverId && previousVehicleId === nextVehicleId) {
    return actionSuccess({ mode, callSign: mapCallSign(before), unchanged: true });
  }

  const updatedAt = new Date().toISOString();
  const previousMeta = before.metadata && typeof before.metadata === "object" ? before.metadata as Record<string, unknown> : {};
  const { data: updated, error: updateError } = await client
    .from("call_signs")
    .update({
      driver_id: nextDriverId,
      vehicle_id: nextVehicleId,
      updated_at: updatedAt,
      metadata: {
        ...previousMeta,
        crewUpdatedAt: updatedAt,
        crewUpdateReason: parsed.data.reason || "ปรับคู่คนขับและรถของ Call Sign"
      }
    })
    .eq("id", parsed.data.callSignId)
    .eq("project_id", parsed.data.projectId)
    .select()
    .single();

  if (updateError) {
    return actionFailure(getDatabaseErrorMessage(updateError, "บันทึกคู่รถของ Call Sign ไม่สำเร็จ"));
  }

  const { error: auditError } = await client.from("call_sign_crew_events").insert({
    project_id: parsed.data.projectId,
    call_sign_id: parsed.data.callSignId,
    previous_driver_id: previousDriverId,
    previous_vehicle_id: previousVehicleId,
    next_driver_id: nextDriverId,
    next_vehicle_id: nextVehicleId,
    reason: parsed.data.reason || null,
    metadata: parsed.data.metadata
  });

  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "call_sign",
    objectId: parsed.data.callSignId,
    eventType: "CALL_SIGN_CREW_UPDATED",
    source: "operation_user",
    reason: parsed.data.reason || "ปรับคู่คนขับและรถของ Call Sign",
    beforeData: before,
    afterData: updated,
    metadata: { action: "update_call_sign_crew", mode, auditError: auditError?.message || null }
  });

  revalidatePath("/assignments");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/projects/${parsed.data.projectId}/assignments`);
  revalidatePath("/mission-control");

  return actionSuccess(
    { mode, callSign: mapCallSign(updated), timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `บันทึกคู่รถแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
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
  if (!permission.allowed) {
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
    driverId: auto.data.driverId || null,
    vehicleId: auto.data.vehicleId || null,
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
      driver_id: parsed.data.driverId || null,
      vehicle_id: parsed.data.vehicleId || null,
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
