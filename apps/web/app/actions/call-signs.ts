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
  vehicleId: z.string().uuid().optional().nullable(),
  /**
   * The mission this unit was set up for. Each unit gets its own, so selecting
   * the unit when opening work is enough to know what it is doing — asking for
   * both was asking the same question twice.
   */
  missionId: z.string().uuid().optional().nullable()
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
    metadata: {
      source: "assignment_form",
      generated: !requestedCallSign,
      // Selecting the unit later is enough to know its mission.
      ...(auto.data.missionId ? { missionId: auto.data.missionId } : {})
    }
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

/**
 * Remove a crewed unit that was put together wrongly.
 *
 * Still refused while the unit has work: a job is someone's plan for the day and
 * deleting the unit under it fails silently on their side rather than here.
 *
 * A live QR is no longer a blocker. It was written when QRs were issued by hand,
 * so it only fired for units somebody had deliberately handed out. Now every
 * unit is given its credentials the moment it is crewed, which made the guard
 * refuse *every* unit — including the one just created by mistake, which is the
 * whole reason delete exists. The QR is revoked as part of the delete instead,
 * and the caller has already confirmed.
 */
export async function deleteCallSignAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; callSignId?: string };
  const projectId = String(data.projectId || "");
  const callSignId = String(data.callSignId || "");
  if (!projectId || !callSignId) return actionFailure("ไม่พบหน่วยรถที่ต้องการลบ");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(projectId, "assignment.update");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์ลบหน่วยรถนี้");

  // Count every assignment, not just the live ones. assignments.call_sign_id is
  // ON DELETE RESTRICT, so a cancelled job blocks the delete just as firmly as a
  // running one — and the card, which hides cancelled work, was showing "0 งาน"
  // next to a delete that failed with a foreign-key message nobody can act on.
  const { count: everUsed } = await client
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("call_sign_id", callSignId);

  const { data: liveJobs } = await client
    .from("assignments")
    .select("id")
    .eq("call_sign_id", callSignId)
    .not("status", "in", '("cancelled","archived")')
    .limit(1);
  if (liveJobs?.length) {
    return actionFailure("ลบไม่ได้ เพราะหน่วยนี้ยังมีงานที่ยังไม่จบ กรุณายกเลิกหรือปิดงานของหน่วยนี้ก่อน");
  }

  // Anything already handed out stops working, deliberately and before the unit
  // itself goes, so a scanned QR meets a revoked credential rather than a
  // dangling reference.
  const revokedAt = new Date().toISOString();
  await client
    .from("driver_access_tokens")
    .update({ status: "revoked", metadata: { revokedReason: "unit_deleted" } })
    .eq("call_sign_id", callSignId)
    .eq("status", "active");
  await client
    .from("observer_access_tokens")
    .update({ status: "revoked", metadata: { revokedReason: "unit_deleted" } })
    .eq("call_sign_id", callSignId)
    .eq("status", "active");
  await client
    .from("driver_mobile_sessions")
    .update({ status: "revoked", revoked_at: revokedAt, updated_at: revokedAt })
    .eq("call_sign_id", callSignId)
    .is("revoked_at", null);

  // A unit that has ever carried work is retired rather than erased: its jobs
  // are history someone may still need to answer for, and the database refuses
  // to drop it out from under them anyway. A unit created by mistake, with no
  // work at all, goes for good.
  if (everUsed && everUsed > 0) {
    const { error: archiveError } = await client
      .from("call_signs")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", callSignId)
      .eq("project_id", projectId);
    if (archiveError) return actionFailure(getDatabaseErrorMessage(archiveError, "เก็บถาวรหน่วยรถไม่สำเร็จ"));
    return actionSuccess(
      { archived: callSignId, retiredJobs: everUsed },
      `หน่วยนี้เคยมีงาน ${everUsed} รายการ จึงเก็บถาวรแทนการลบ เพื่อไม่ให้ประวัติงานหาย — หน่วยจะไม่แสดงในรายการอีก`
    );
  }

  const { error: deleteError } = await client.from("call_signs").delete().eq("id", callSignId).eq("project_id", projectId);
  if (deleteError) return actionFailure(getDatabaseErrorMessage(deleteError, "ลบหน่วยรถไม่สำเร็จ"));

  return actionSuccess({ deleted: callSignId });
}

/** Revoke a unit's live QR so the unit can be corrected or removed. */
export async function revokeCallSignQrAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; callSignId?: string };
  const projectId = String(data.projectId || "");
  const callSignId = String(data.callSignId || "");
  if (!projectId || !callSignId) return actionFailure("ไม่พบหน่วยรถ");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(projectId, "assignment.update");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์จัดการ QR ของหน่วยนี้");

  const revokedAt = new Date().toISOString();
  await client
    .from("driver_access_tokens")
    .update({ status: "revoked", metadata: { revokedReason: "unit_corrected" } })
    .eq("call_sign_id", callSignId)
    .eq("status", "active");
  await client
    .from("observer_access_tokens")
    .update({ status: "revoked", metadata: { revokedReason: "unit_corrected" } })
    .eq("call_sign_id", callSignId)
    .eq("status", "active");
  await client
    .from("driver_mobile_sessions")
    .update({ status: "revoked", revoked_at: revokedAt, updated_at: revokedAt })
    .eq("call_sign_id", callSignId)
    .is("revoked_at", null);

  return actionSuccess({ revoked: callSignId });
}
