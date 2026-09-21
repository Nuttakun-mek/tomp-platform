"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDriverSchema, createVehicleSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { mapCallSign, mapDriver, mapVehicle } from "@/lib/data/mappers";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

const VEHICLE_ICON_KEYS = new Set(["sedan", "suv", "van", "minibus", "bus", "pickup", "truck", "motorcycle"]);

const createExistingProjectResourcePairSchema = z.object({
  projectId: z.string().uuid(),
  callSign: z.string().trim().max(40).optional().nullable(),
  driverId: z.string().uuid(),
  vehicleId: z.string().uuid()
});

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function callSignSeed(value: string) {
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9ก-ฮ]/g, "")
    .slice(-6);
  return cleaned || "UNIT";
}

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
    if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างข้อมูลคนขับ");
  }

  const { data, error: insertError } = await client
    .from("drivers")
    .insert({
      organization_id: parsed.data.organizationId || null,
      vendor_id: parsed.data.vendorId || null,
      project_id: parsed.data.projectId || null,
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
    : actionSuccess(null, "ยังไม่มี projectId จึงยังไม่สร้าง Timeline ของโครงการ");

  revalidatePath("/resources");
  revalidatePath("/resources/drivers");
  if (timelineProjectId) revalidatePath("/projects/[projectCode]/ground-transfer", "layout");

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
    if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างข้อมูลรถ");
  }

  const { data, error: insertError } = await client
    .from("vehicles")
    .insert({
      organization_id: parsed.data.organizationId || null,
      vendor_id: parsed.data.vendorId || null,
      project_id: parsed.data.projectId || null,
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
    : actionSuccess(null, "ยังไม่มี projectId จึงยังไม่สร้าง Timeline ของโครงการ");

  revalidatePath("/resources");
  revalidatePath("/resources/vehicles");
  if (timelineProjectId) revalidatePath("/projects/[projectCode]/ground-transfer", "layout");

  return actionSuccess(
    { mode, vehicle, timelineEvent: timelineResult.data },
    timelineResult.success ? timelineResult.warning : `สร้างข้อมูลรถแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}

export async function createProjectResourcePairAction(input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as Record<string, unknown>;
  const projectId = cleanText(data.projectId);
  if (!projectId) return actionFailure("ไม่พบโครงการ");

  const driverParsed = createDriverSchema.safeParse({
    fullName: data.fullName,
    phone: data.phone,
    licenseType: cleanText(data.licenseType) || null,
    languages: [],
    projectId,
    metadata: {
      nickname: cleanText(data.nickname),
      note: cleanText(data.driverNote),
      preparedAsPair: true
    }
  });
  if (!driverParsed.success) return actionFailure("กรอกชื่อคนขับและเบอร์โทรศัพท์ให้ครบ", driverParsed.error.flatten().fieldErrors);

  const icon = cleanText(data.vehicleIcon);
  const requestedCallSign = cleanText(data.callSign);
  const packageHours = numberOrNull(data.packageHours);
  const packageAmount = numberOrNull(data.packageAmount);
  const derivedHourlyRate = packageHours && packageAmount ? Math.round((packageAmount / packageHours) * 100) / 100 : null;
  const vehicleParsed = createVehicleSchema.safeParse({
    plateNumber: data.plateNumber,
    vehicleType: data.vehicleType,
    capacity: data.capacity,
    projectId,
    metadata: {
      brand: cleanText(data.brand),
      model: cleanText(data.model),
      colour: cleanText(data.colour),
      icon: VEHICLE_ICON_KEYS.has(icon) ? icon : "van",
      packageHours,
      packageAmount,
      hourlyRate: derivedHourlyRate,
      minimumHours: packageHours,
      costNote: cleanText(data.costNote),
      preparedAsPair: true
    }
  });
  if (!vehicleParsed.success) return actionFailure("กรอกทะเบียนรถ ประเภทรถ และจำนวนที่นั่งให้ครบ", vehicleParsed.error.flatten().fieldErrors);

  const driverPermission = await requirePermission(projectId, "driver.create");
  if (!driverPermission.allowed) return actionFailure(driverPermission.reason || "ไม่มีสิทธิ์สร้างข้อมูลคนขับ");
  const vehiclePermission = await requirePermission(projectId, "vehicle.create");
  if (!vehiclePermission.allowed) return actionFailure(vehiclePermission.reason || "ไม่มีสิทธิ์สร้างข้อมูลรถ");

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const { data: driverRow, error: driverError } = await client
    .from("drivers")
    .insert({
      organization_id: driverParsed.data.organizationId || null,
      vendor_id: driverParsed.data.vendorId || null,
      project_id: projectId,
      full_name: driverParsed.data.fullName,
      phone: driverParsed.data.phone,
      license_type: driverParsed.data.licenseType || null,
      languages: driverParsed.data.languages,
      status: "available",
      metadata: driverParsed.data.metadata
    })
    .select()
    .single();

  if (driverError || !driverRow) return actionFailure(getDatabaseErrorMessage(driverError, "บันทึกข้อมูลคนขับไม่สำเร็จ"));

  const { data: vehicleRow, error: vehicleError } = await client
    .from("vehicles")
    .insert({
      organization_id: vehicleParsed.data.organizationId || null,
      vendor_id: vehicleParsed.data.vendorId || null,
      project_id: projectId,
      plate_number: vehicleParsed.data.plateNumber,
      vehicle_type: vehicleParsed.data.vehicleType,
      capacity: vehicleParsed.data.capacity,
      status: "available",
      metadata: vehicleParsed.data.metadata
    })
    .select()
    .single();

  if (vehicleError || !vehicleRow) {
    await client.from("drivers").delete().eq("id", driverRow.id);
    return actionFailure(getDatabaseErrorMessage(vehicleError, "บันทึกข้อมูลรถไม่สำเร็จ"));
  }

  let generatedCallSign = requestedCallSign;
  if (!generatedCallSign) {
    const seed = callSignSeed(String(vehicleRow.plate_number || vehicleParsed.data.plateNumber));
    const { count } = await client
      .from("call_signs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    generatedCallSign = `${seed}-${String((count || 0) + 1).padStart(2, "0")}`;
  }
  const { data: callSignRow, error: callSignError } = await client
    .from("call_signs")
    .insert({
      project_id: projectId,
      call_sign: generatedCallSign,
      group_name: "ปฏิบัติการ",
      driver_id: driverRow.id,
      vehicle_id: vehicleRow.id,
      status: "active",
      metadata: {
        source: "project_resource_pair_form",
        generated: !requestedCallSign,
        preparedAsPair: true
      }
    })
    .select()
    .single();

  if (callSignError || !callSignRow) {
    await Promise.all([
      client.from("vehicles").delete().eq("id", vehicleRow.id),
      client.from("drivers").delete().eq("id", driverRow.id)
    ]);
    return actionFailure(getDatabaseErrorMessage(callSignError, "สร้างหน่วยรถจากคู่คนขับและรถไม่สำเร็จ"));
  }

  const driverMeta = { ...(driverParsed.data.metadata as Record<string, unknown>), pairedVehicleId: vehicleRow.id, pairedCallSignId: callSignRow.id };
  const vehicleMeta = { ...(vehicleParsed.data.metadata as Record<string, unknown>), pairedDriverId: driverRow.id, pairedCallSignId: callSignRow.id };
  await Promise.all([
    client.from("drivers").update({ metadata: driverMeta }).eq("id", driverRow.id),
    client.from("vehicles").update({ metadata: vehicleMeta }).eq("id", vehicleRow.id)
  ]);

  const [driverTimeline, vehicleTimeline, callSignTimeline] = await Promise.all([
    createTimelineEvent({
      projectId,
      objectType: "driver",
      objectId: String(driverRow.id),
      eventType: TIMELINE_EVENTS.DRIVER_CREATED,
      source: "operation_user",
      reason: "สร้างข้อมูลคนขับพร้อมรถจากหน้าทรัพยากรโครงการ",
      afterData: { ...driverRow, metadata: driverMeta }
    }),
    createTimelineEvent({
      projectId,
      objectType: "vehicle",
      objectId: String(vehicleRow.id),
      eventType: TIMELINE_EVENTS.VEHICLE_CREATED,
      source: "operation_user",
      reason: "สร้างข้อมูลรถพร้อมคนขับจากหน้าทรัพยากรโครงการ",
      afterData: { ...vehicleRow, metadata: vehicleMeta }
    }),
    createTimelineEvent({
      projectId,
      objectType: "call_sign",
      objectId: String(callSignRow.id),
      eventType: "CALL_SIGN_CREATED",
      source: "operation_user",
      reason: "สร้างหน่วยรถอัตโนมัติจากคู่คนขับและรถ",
      afterData: callSignRow,
      metadata: { action: "create_call_sign_from_resource_pair" }
    })
  ]);

  revalidatePath("/resources");
  revalidatePath("/projects/[projectCode]/ground-transfer", "layout");

  return actionSuccess(
    {
      mode,
      driver: mapDriver({ ...driverRow, metadata: driverMeta }),
      vehicle: mapVehicle({ ...vehicleRow, metadata: vehicleMeta }),
      callSign: mapCallSign(callSignRow),
      timelineEvents: [driverTimeline.data, vehicleTimeline.data, callSignTimeline.data].filter(Boolean)
    },
    driverTimeline.success && vehicleTimeline.success && callSignTimeline.success ? undefined : "บันทึกข้อมูลแล้ว แต่ Timeline บางรายการบันทึกไม่สำเร็จ"
  );
}

export async function createExistingProjectResourcePairAction(input: unknown): Promise<ActionResult> {
  const parsed = createExistingProjectResourcePairSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("เลือกคนขับและรถให้ครบก่อนสร้างหน่วยรถ", parsed.error.flatten().fieldErrors);
  }

  const permission = await requirePermission(parsed.data.projectId, "assignment.create");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างหน่วยรถในโครงการนี้");

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const requestedCallSign = parsed.data.callSign?.trim();
  let nextCallSign = requestedCallSign || "";
  const [{ data: driverRow, error: driverReadError }, { data: vehicleRow, error: vehicleReadError }] = await Promise.all([
    client
      .from("drivers")
      .select("id, metadata")
      .eq("id", parsed.data.driverId)
      .eq("project_id", parsed.data.projectId)
      .maybeSingle(),
    client
      .from("vehicles")
      .select("id, plate_number, metadata")
      .eq("id", parsed.data.vehicleId)
      .eq("project_id", parsed.data.projectId)
      .maybeSingle()
  ]);

  if (driverReadError || !driverRow) return actionFailure(getDatabaseErrorMessage(driverReadError, "ไม่พบข้อมูลคนขับในโครงการนี้"));
  if (vehicleReadError || !vehicleRow) return actionFailure(getDatabaseErrorMessage(vehicleReadError, "ไม่พบข้อมูลรถในโครงการนี้"));

  const { data: existingUnit, error: existingUnitError } = await client
    .from("call_signs")
    .select("call_sign, driver_id, vehicle_id")
    .eq("project_id", parsed.data.projectId)
    .neq("status", "archived")
    .or(`driver_id.eq.${parsed.data.driverId},vehicle_id.eq.${parsed.data.vehicleId}`)
    .limit(1)
    .maybeSingle();

  if (existingUnitError) return actionFailure(getDatabaseErrorMessage(existingUnitError, "ตรวจสอบการจับคู่หน่วยรถไม่สำเร็จ"));
  if (existingUnit) {
    if (existingUnit.driver_id === parsed.data.driverId) return actionFailure(`คนขับนี้ถูกจับคู่อยู่แล้วในหน่วยรถ ${existingUnit.call_sign}`);
    if (existingUnit.vehicle_id === parsed.data.vehicleId) return actionFailure(`รถคันนี้ถูกจับคู่อยู่แล้วในหน่วยรถ ${existingUnit.call_sign}`);
    return actionFailure(`ทรัพยากรนี้ถูกจับคู่อยู่แล้วในหน่วยรถ ${existingUnit.call_sign}`);
  }

  if (!nextCallSign) {
    const seed = callSignSeed(String(vehicleRow.plate_number || "UNIT"));
    const { count } = await client
      .from("call_signs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", parsed.data.projectId);
    nextCallSign = `${seed}-${String((count || 0) + 1).padStart(2, "0")}`;
  }

  const { data: callSignRow, error: callSignError } = await client
    .from("call_signs")
    .insert({
      project_id: parsed.data.projectId,
      call_sign: nextCallSign,
      group_name: "ปฏิบัติการ",
      driver_id: parsed.data.driverId,
      vehicle_id: parsed.data.vehicleId,
      status: "active",
      metadata: {
        source: "project_resource_existing_pair_form",
        generated: !requestedCallSign,
        preparedAsPair: true
      }
    })
    .select()
    .single();

  if (callSignError || !callSignRow) {
    return actionFailure(getDatabaseErrorMessage(callSignError, "สร้างหน่วยรถจากทรัพยากรที่มีอยู่ไม่สำเร็จ"));
  }

  const now = new Date().toISOString();
  const driverMeta = {
    ...((driverRow.metadata && typeof driverRow.metadata === "object" ? driverRow.metadata : {}) as Record<string, unknown>),
    pairedVehicleId: parsed.data.vehicleId,
    pairedCallSignId: callSignRow.id,
    pairedAt: now
  };
  const vehicleMeta = {
    ...((vehicleRow.metadata && typeof vehicleRow.metadata === "object" ? vehicleRow.metadata : {}) as Record<string, unknown>),
    pairedDriverId: parsed.data.driverId,
    pairedCallSignId: callSignRow.id,
    pairedAt: now
  };
  await Promise.all([
    client.from("drivers").update({ metadata: driverMeta }).eq("id", parsed.data.driverId).eq("project_id", parsed.data.projectId),
    client.from("vehicles").update({ metadata: vehicleMeta }).eq("id", parsed.data.vehicleId).eq("project_id", parsed.data.projectId)
  ]);

  const timelineResult = await createTimelineEvent({
    projectId: parsed.data.projectId,
    objectType: "call_sign",
    objectId: String(callSignRow.id),
    eventType: "CALL_SIGN_CREATED",
    source: "operation_user",
    reason: "สร้างหน่วยรถจากทรัพยากรที่มีอยู่ในโครงการ",
    afterData: callSignRow,
    metadata: { action: "create_existing_project_resource_pair", mode }
  });

  revalidatePath("/resources");
  revalidatePath("/projects/[projectCode]/ground-transfer", "layout");

  return actionSuccess(
    { mode, callSign: mapCallSign(callSignRow), timelineEvent: timelineResult.data },
    timelineResult.success ? undefined : `สร้างหน่วยรถแล้ว แต่บันทึก Timeline ไม่สำเร็จ: ${timelineResult.error}`
  );
}

// ---------------------------------------------------------------------------
// Project-scoped resources
//
// A project keeps its own copies of the people and vehicles it uses, so one
// project's edits, notes and availability never reach another. The library —
// rows with no project_id — is the master list to draw from. See migration 0035.
// ---------------------------------------------------------------------------

type Table = "drivers" | "vehicles";

/** Guard shared by both deletes: refuse while the resource is still crewed or working. */
async function blockingUses(
  client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>,
  table: Table,
  id: string
): Promise<string | null> {
  const column = table === "drivers" ? "driver_id" : "vehicle_id";

  const { data: crewed } = await client.from("call_signs").select("call_sign").eq(column, id).is("deleted_at", null).limit(1);
  if (crewed?.length) {
    return `ลบไม่ได้ เพราะยังถูกจับคู่อยู่ในหน่วยรถ ${crewed[0].call_sign} กรุณายกเลิกการจับคู่ก่อน`;
  }

  const { data: working } = await client
    .from("assignments")
    .select("id")
    .eq(column, id)
    .not("status", "in", '("cancelled","archived","completed")')
    .limit(1);
  if (working?.length) {
    return "ลบไม่ได้ เพราะยังมีงานที่ยังไม่จบผูกอยู่ กรุณายกเลิกหรือปิดงานนั้นก่อน";
  }

  return null;
}

async function removeResource(table: Table, input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { id?: string; projectId?: string };
  const id = String(data.id || "");
  const projectId = String(data.projectId || "");
  if (!id) return actionFailure("ไม่พบรายการที่ต้องการลบ");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permissionKey = table === "drivers" ? "driver.create" : "vehicle.create";
  const permission = projectId
    ? await requirePermission(projectId, permissionKey)
    : await requirePermission(permissionKey);
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์ลบทรัพยากรนี้");

  const blocked = await blockingUses(client, table, id);
  if (blocked) return actionFailure(blocked);

  const { error: deleteError } = await client.from(table).delete().eq("id", id);
  if (deleteError) return actionFailure(getDatabaseErrorMessage(deleteError, "ลบไม่สำเร็จ"));

  if (projectId) {
    revalidatePath(`/resources`);
    revalidatePath("/projects/[projectCode]/ground-transfer", "layout");
  }
  return actionSuccess({ deleted: id });
}

export async function deleteDriverAction(input: unknown): Promise<ActionResult> {
  return removeResource("drivers", input);
}

export async function deleteVehicleAction(input: unknown): Promise<ActionResult> {
  return removeResource("vehicles", input);
}

/**
 * Copy library records into a project.
 *
 * A copy, not a reference: the whole point of project scoping is that changing a
 * phone number or marking someone unavailable here does not touch another
 * project's view of the same person.
 */
async function importResources(table: Table, input: unknown): Promise<ActionResult> {
  const data = (input ?? {}) as { projectId?: string; ids?: string[] };
  const projectId = String(data.projectId || "");
  const ids = Array.isArray(data.ids) ? data.ids.filter((id) => typeof id === "string" && id) : [];
  if (!projectId) return actionFailure("ไม่พบโครงการ");
  if (!ids.length) return actionFailure("กรุณาเลือกอย่างน้อยหนึ่งรายการ");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  const permission = await requirePermission(projectId, table === "drivers" ? "driver.create" : "vehicle.create");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์เพิ่มทรัพยากรในโครงการนี้");

  const { data: sources, error: readError } = await client.from(table).select("*").in("id", ids).is("project_id", null);
  if (readError) return actionFailure(getDatabaseErrorMessage(readError, "อ่านข้อมูลจากคลังกลางไม่สำเร็จ"));
  if (!sources?.length) return actionFailure("ไม่พบรายการที่เลือกในคลังกลาง");

  const rows = sources.map((source) => {
    const copy = { ...(source as Record<string, unknown>) };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    copy.project_id = projectId;
    copy[table === "drivers" ? "source_driver_id" : "source_vehicle_id"] = (source as { id: string }).id;
    // A copy starts free: availability is a fact about this project, not about
    // whatever the person was doing on someone else's event.
    copy.status = "available";
    return copy;
  });

  const { data: inserted, error: insertError } = await client.from(table).insert(rows).select();
  if (insertError) {
    // The partial unique index in 0035 is what refuses a second copy.
    const message = /duplicate key|unique/i.test(insertError.message)
      ? "บางรายการถูกนำเข้าโครงการนี้แล้ว กรุณาเลือกเฉพาะรายการที่ยังไม่มี"
      : "นำเข้าไม่สำเร็จ";
    return actionFailure(getDatabaseErrorMessage(insertError, message));
  }

  revalidatePath("/resources");
  revalidatePath("/projects/[projectCode]/ground-transfer", "layout");
  return actionSuccess({ imported: inserted?.length ?? 0 });
}

export async function importDriversFromLibraryAction(input: unknown): Promise<ActionResult> {
  return importResources("drivers", input);
}

export async function importVehiclesFromLibraryAction(input: unknown): Promise<ActionResult> {
  return importResources("vehicles", input);
}
