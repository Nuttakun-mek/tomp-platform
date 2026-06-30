"use server";

import { createDriverSchema, createVehicleSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { mapDriver, mapVehicle } from "@/lib/data/mappers";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

export async function createDriverAction(input: unknown): Promise<ActionResult> {
  const parsed = createDriverSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูลคนขับไม่ครบถ้วน", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  }
  const projectId = typeof parsed.data.metadata.projectId === "string" ? parsed.data.metadata.projectId : parsed.data.organizationId;
  if (projectId) {
    const permission = await requirePermission(projectId, "driver.create");
    if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างข้อมูลคนขับ");
  }

  const { data, error: insertError } = await client
    .from("drivers")
    .insert({
      organization_id: parsed.data.organizationId || null,
      vendor_id: parsed.data.vendorId || null,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      license_type: parsed.data.licenseType || null,
      languages: parsed.data.languages,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(getDatabaseErrorMessage(insertError, "บันทึกข้อมูลคนขับไม่สำเร็จ"));
  }

  const driver = mapDriver(data);
  const timelineProjectId = typeof parsed.data.metadata.projectId === "string" ? parsed.data.metadata.projectId : null;
  const timelineResult = timelineProjectId
    ? await createTimelineEvent({
        projectId: timelineProjectId,
        objectType: "driver",
        objectId: driver.id,
        eventType: TIMELINE_EVENTS.DRIVER_CREATED,
        source: "operation_user",
        reason: "สร้างข้อมูลคนขับจากหน้าทรัพยากร",
        afterData: data
      })
    : actionSuccess(null, "ไม่มี projectId จึงยังไม่สร้าง Timeline ของโครงการ");

  return actionSuccess(
    { mode, driver, timelineEvent: timelineResult.data },
    timelineResult.success ? timelineResult.warning : `สร้างข้อมูลคนขับแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}

export async function createVehicleAction(input: unknown): Promise<ActionResult> {
  const parsed = createVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("ข้อมูลรถไม่ครบถ้วน", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");
  }
  const projectId = typeof parsed.data.metadata.projectId === "string" ? parsed.data.metadata.projectId : parsed.data.organizationId;
  if (projectId) {
    const permission = await requirePermission(projectId, "vehicle.create");
    if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างข้อมูลรถ");
  }

  const { data, error: insertError } = await client
    .from("vehicles")
    .insert({
      organization_id: parsed.data.organizationId || null,
      vendor_id: parsed.data.vendorId || null,
      plate_number: parsed.data.plateNumber,
      vehicle_type: parsed.data.vehicleType,
      capacity: parsed.data.capacity,
      metadata: parsed.data.metadata
    })
    .select()
    .single();

  if (insertError) {
    return actionFailure(getDatabaseErrorMessage(insertError, "บันทึกข้อมูลรถไม่สำเร็จ"));
  }

  const vehicle = mapVehicle(data);
  const timelineProjectId = typeof parsed.data.metadata.projectId === "string" ? parsed.data.metadata.projectId : null;
  const timelineResult = timelineProjectId
    ? await createTimelineEvent({
        projectId: timelineProjectId,
        objectType: "vehicle",
        objectId: vehicle.id,
        eventType: TIMELINE_EVENTS.VEHICLE_CREATED,
        source: "operation_user",
        reason: "สร้างข้อมูลรถจากหน้าทรัพยากร",
        afterData: data
      })
    : actionSuccess(null, "ไม่มี projectId จึงยังไม่สร้าง Timeline ของโครงการ");

  return actionSuccess(
    { mode, vehicle, timelineEvent: timelineResult.data },
    timelineResult.success ? timelineResult.warning : `สร้างข้อมูลรถแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}
