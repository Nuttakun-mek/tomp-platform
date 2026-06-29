"use server";

import { createDriverSchema, createVehicleSchema } from "@tomp/types/schemas";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { mapDriver, mapVehicle } from "@/lib/data/mappers";
import { requirePermission } from "@/lib/auth/rbac";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

export async function createDriverAction(input: unknown): Promise<ActionResult> {
  const parsed = createDriverSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Driver validation failed.", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "Supabase is not configured for writes.");
  }
  const projectId = typeof parsed.data.metadata.projectId === "string" ? parsed.data.metadata.projectId : parsed.data.organizationId;
  if (projectId) {
    const permission = await requirePermission(projectId, "driver.create");
    if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "Missing permission: driver.create");
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
    return actionFailure(`Database insert failed: ${insertError.message}`);
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
        reason: "Driver resource created from server action.",
        afterData: data
      })
    : actionSuccess(null, "No projectId metadata was provided, so no project timeline event was created.");

  return actionSuccess(
    { mode, driver, timelineEvent: timelineResult.data },
    timelineResult.success ? timelineResult.warning : `Driver was created, but timeline insert failed: ${timelineResult.error}`
  );
}

export async function createVehicleAction(input: unknown): Promise<ActionResult> {
  const parsed = createVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure("Vehicle validation failed.", parsed.error.flatten().fieldErrors);
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    return actionFailure(error || "Supabase is not configured for writes.");
  }
  const projectId = typeof parsed.data.metadata.projectId === "string" ? parsed.data.metadata.projectId : parsed.data.organizationId;
  if (projectId) {
    const permission = await requirePermission(projectId, "vehicle.create");
    if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "Missing permission: vehicle.create");
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
    return actionFailure(`Database insert failed: ${insertError.message}`);
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
        reason: "Vehicle resource created from server action.",
        afterData: data
      })
    : actionSuccess(null, "No projectId metadata was provided, so no project timeline event was created.");

  return actionSuccess(
    { mode, vehicle, timelineEvent: timelineResult.data },
    timelineResult.success ? timelineResult.warning : `Vehicle was created, but timeline insert failed: ${timelineResult.error}`
  );
}
