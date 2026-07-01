"use server";

import { randomUUID } from "crypto";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { generateDriverAccessToken, getDefaultDriverTokenExpiry, hashDriverAccessToken } from "@/lib/driver-access/token";
import { buildWebDriverAssignmentPacket } from "@/lib/driver/assignment-packet";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

const requiredTables = [
  "organizations",
  "projects",
  "missions",
  "assignments",
  "driver_access_tokens",
  "driver_assignment_packets",
  "driver_notifications",
  "route_change_instructions",
  "driver_location_sessions",
  "driver_acknowledgements",
  "gps_locations",
  "timeline_events"
];

function baseRecord(id: string) {
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now, metadata: {} };
}

export async function checkPilotInfrastructureAction(): Promise<ActionResult> {
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับตรวจระบบ");

  const tableResults = [];
  for (const table of requiredTables) {
    const { error: tableError } = await client.from(table).select("*").limit(1);
    tableResults.push({
      table,
      ok: !tableError,
      message: tableError ? tableError.message : "พร้อมใช้งาน"
    });
  }

  return actionSuccess({
    mode,
    checkedAt: new Date().toISOString(),
    tables: tableResults,
    ready: tableResults.every((row) => row.ok)
  });
}

export async function createProductionPilotSmokeScenarioAction(): Promise<ActionResult> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับสร้างชุดทดสอบ");

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const endTime = new Date(now.getTime() + 90 * 60 * 1000).toISOString();
  const suffix = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);

  const ids = {
    organization: randomUUID(),
    profile: randomUUID(),
    project: randomUUID(),
    day: randomUUID(),
    session: randomUUID(),
    mission: randomUUID(),
    callSign: randomUUID(),
    vehicle: randomUUID(),
    driver: randomUUID(),
    assignment: randomUUID()
  };

  const projectName = `ทดสอบ Pilot ${suffix}`;
  const pickupLocation = "จุดรับผู้โดยสาร";
  const dropoffLocation = "จุดส่งปลายทาง";

  const steps = [
    client.from("organizations").insert({
      id: ids.organization,
      name: "TOMP Internal Pilot",
      organization_type: "operator",
      status: "active",
      metadata: { smokeTest: true }
    }),
    client.from("profiles").insert({
      id: ids.profile,
      auth_user_id: null,
      organization_id: ids.organization,
      full_name: "ผู้ดูแลทดสอบ Pilot",
      email: `pilot-${suffix}@example.com`,
      phone: "+6620000000",
      status: "active",
      metadata: { smokeTest: true }
    }),
    client.from("projects").insert({
      id: ids.project,
      organization_id: ids.organization,
      owner_profile_id: ids.profile,
      project_code: `PILOT-${suffix}`,
      project_name: projectName,
      start_date: today,
      end_date: today,
      timezone: "Asia/Bangkok",
      status: "planning",
      visibility_level: "internal",
      service_level: "standard",
      metadata: { smokeTest: true }
    }),
    client.from("project_days").insert({
      id: ids.day,
      project_id: ids.project,
      operation_date: today,
      day_number: 1,
      timezone: "Asia/Bangkok",
      status: "draft",
      metadata: { smokeTest: true }
    }),
    client.from("sessions").insert({
      id: ids.session,
      project_id: ids.project,
      project_day_id: ids.day,
      session_name: "รอบทดสอบ Pilot",
      session_type: "pilot_smoke_test",
      start_time: startTime,
      end_time: endTime,
      status: "draft",
      metadata: { smokeTest: true }
    }),
    client.from("missions").insert({
      id: ids.mission,
      project_id: ids.project,
      project_day_id: ids.day,
      session_id: ids.session,
      mission_code: `MIS-${suffix}`,
      mission_name: "รับส่งทดสอบระบบ",
      mission_type: "driver_tracking_test",
      priority: "normal",
      status: "draft",
      planned_start_time: startTime,
      planned_end_time: endTime,
      instruction: "ให้คนขับเปิดหน้าคนขับและแชร์ GPS",
      service_commitment: "ศูนย์ควบคุมต้องเห็นตำแหน่งล่าสุด",
      metadata: { pickupLocation, dropoffLocation, commitmentTime: new Date(startTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) }
    }),
    client.from("call_signs").insert({
      id: ids.callSign,
      project_id: ids.project,
      call_sign: `PILOT-${suffix.slice(-4)}`,
      group_name: "ทดสอบ Pilot",
      status: "active",
      metadata: { smokeTest: true }
    }),
    client.from("vehicles").insert({
      id: ids.vehicle,
      organization_id: ids.organization,
      vendor_id: null,
      plate_number: `TEST-${suffix.slice(-4)}`,
      vehicle_type: "รถทดสอบ",
      capacity: 4,
      status: "assigned",
      metadata: { smokeTest: true }
    }),
    client.from("drivers").insert({
      id: ids.driver,
      organization_id: ids.organization,
      vendor_id: null,
      full_name: "คนขับทดสอบ Pilot",
      phone: "+66810000000",
      license_type: "pilot",
      languages: ["th"],
      status: "assigned",
      metadata: { smokeTest: true }
    }),
    client.from("assignments").insert({
      id: ids.assignment,
      project_id: ids.project,
      mission_id: ids.mission,
      call_sign_id: ids.callSign,
      vehicle_id: ids.vehicle,
      driver_id: ids.driver,
      status: "planned",
      start_time: startTime,
      end_time: endTime,
      current_version: 1,
      metadata: {
        smokeTest: true,
        pickupLocation,
        dropoffLocation,
        commitmentTime: new Date(startTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
        coordinatorPhone: "+6620000000",
        operationPhone: "+6621111111"
      }
    })
  ];

  for (const step of steps) {
    const { error: stepError } = await step;
    if (stepError) return actionFailure(getDatabaseErrorMessage(stepError, "สร้างชุดทดสอบ Pilot ไม่สำเร็จ"));
  }

  const project = {
    ...baseRecord(ids.project),
    organizationId: ids.organization,
    ownerProfileId: ids.profile,
    projectCode: `PILOT-${suffix}`,
    projectName,
    startDate: today,
    endDate: today,
    timezone: "Asia/Bangkok",
    status: "planning" as const,
    visibilityLevel: "internal",
    serviceLevel: "standard"
  };
  const assignment = {
    ...baseRecord(ids.assignment),
    projectId: ids.project,
    missionId: ids.mission,
    callSignId: ids.callSign,
    vehicleId: ids.vehicle,
    driverId: ids.driver,
    status: "planned" as const,
    startTime,
    endTime,
    commitmentId: null,
    currentVersion: 1,
    metadata: { pickupLocation, dropoffLocation, commitmentTime: new Date(startTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) }
  };
  const callSign = { ...baseRecord(ids.callSign), projectId: ids.project, callSign: `PILOT-${suffix.slice(-4)}`, groupName: "ทดสอบ Pilot", status: "active" as const };
  const driver = { ...baseRecord(ids.driver), organizationId: ids.organization, vendorId: null, fullName: "คนขับทดสอบ Pilot", phone: "+66810000000", licenseType: "pilot", languages: ["th"], status: "assigned" as const };
  const vehicle = { ...baseRecord(ids.vehicle), organizationId: ids.organization, vendorId: null, plateNumber: `TEST-${suffix.slice(-4)}`, vehicleType: "รถทดสอบ", capacity: 4, status: "assigned" as const };
  const packet = buildWebDriverAssignmentPacket({ project, assignment, callSign, driver, vehicle, missionName: "รับส่งทดสอบระบบ" });

  const expiresAt = getDefaultDriverTokenExpiry();
  const token = generateDriverAccessToken({ assignmentId: ids.assignment, driverId: ids.driver, expiresAt });

  const [{ data: tokenRow, error: tokenError }, { data: packetRow, error: packetError }, notificationResult, routeChangeResult] = await Promise.all([
    client
      .from("driver_access_tokens")
      .insert({
        project_id: ids.project,
        assignment_id: ids.assignment,
        driver_id: ids.driver,
        token_hash: hashDriverAccessToken(token),
        status: "active",
        expires_at: expiresAt,
        metadata: { smokeTest: true }
      })
      .select("id")
      .single(),
    client
      .from("driver_assignment_packets")
      .insert({
        project_id: ids.project,
        assignment_id: ids.assignment,
        driver_id: ids.driver,
        packet_version: 1,
        payload: packet,
        published_at: new Date().toISOString(),
        metadata: { smokeTest: true }
      })
      .select("id")
      .single(),
    client.from("driver_notifications").insert({
      project_id: ids.project,
      assignment_id: ids.assignment,
      driver_id: ids.driver,
      notification_type: "assignment_created",
      priority: "normal",
      title: "งานใหม่",
      body: "กรุณาตรวจสอบรายละเอียดงานและกดรับทราบ",
      action_label: "รับทราบ",
      status: "unread",
      sent_at: new Date().toISOString(),
      metadata: { smokeTest: true }
    }),
    client.from("route_change_instructions").insert({
      project_id: ids.project,
      assignment_id: ids.assignment,
      requested_by: ids.profile,
      approved_by: null,
      old_route: null,
      new_route: packet.routeInstruction.routePlan,
      reason: "ทดสอบการแจ้งเปลี่ยนเส้นทาง",
      impact_summary: "คนขับต้องกดรับทราบก่อนเดินทางต่อ",
      status: "pending",
      sent_to_driver_at: new Date().toISOString(),
      metadata: { smokeTest: true }
    })
  ]);

  if (tokenError) return actionFailure(getDatabaseErrorMessage(tokenError, "สร้าง QR ไม่สำเร็จ"));
  if (packetError) return actionFailure(getDatabaseErrorMessage(packetError, "สร้าง assignment packet ไม่สำเร็จ"));
  if (notificationResult.error) return actionFailure(getDatabaseErrorMessage(notificationResult.error, "สร้าง notification ไม่สำเร็จ"));
  if (routeChangeResult.error) return actionFailure(getDatabaseErrorMessage(routeChangeResult.error, "สร้าง route change ไม่สำเร็จ"));

  await createTimelineEvent({
    projectId: ids.project,
    objectType: "assignment",
    objectId: ids.assignment,
    eventType: TIMELINE_EVENTS.DRIVER_ACCESS_TOKEN_CREATED,
    source: "operation_user",
    reason: "สร้างชุดทดสอบ Production Pilot Smoke Test",
    afterData: { tokenId: tokenRow.id, packetId: packetRow.id }
  });

  return actionSuccess({
    projectId: ids.project,
    assignmentId: ids.assignment,
    driverId: ids.driver,
    accessUrl: buildDriverAccessUrl(token),
    missionControlUrl: `/mission-control?projectId=${ids.project}`,
    assignmentsUrl: `/projects/${ids.project}/assignments`,
    packetId: packetRow.id,
    tokenId: tokenRow.id
  });
}
