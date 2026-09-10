"use server";

import { randomUUID } from "crypto";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { withTimeout } from "@/lib/async/timeout";
import { checkPilotInfrastructureViaPostgres, createPilotScenarioViaPostgres } from "@/lib/db/pilot-scenario";
import { PILOT_REQUIRED_TABLES } from "@/lib/db/pilot-tables";
import { generateDriverAccessToken, generateDriverPin, getDefaultDriverTokenExpiry, hashDriverAccessToken, hashDriverPin } from "@/lib/driver-access/token";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { buildWebDriverAssignmentPacket } from "@/lib/driver/assignment-packet";
import { getRequestBaseUrl } from "@/lib/request-origin";
import { getSupabaseConnectionMessage } from "@/lib/supabase/errors";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { TIMELINE_EVENTS } from "@/lib/timeline";

const requiredTables = PILOT_REQUIRED_TABLES;

type InsertStep = {
  label: string;
  run: () => PromiseLike<{ error: unknown }>;
};

function baseRecord(id: string) {
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now, metadata: {} };
}

async function runInsertStep(step: InsertStep) {
  try {
    const { error } = await withTimeout(step.run(), 5000, step.label);
    if (error) return getDatabaseErrorMessage(error, `${step.label} ไม่สำเร็จ`);
    return null;
  } catch (error) {
    return getSupabaseConnectionMessage(error);
  }
}

export async function checkPilotInfrastructureAction(): Promise<ActionResult> {
  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) {
    const postgresResult = await withTimeout(checkPilotInfrastructureViaPostgres(), 5000, "pilot infrastructure fallback").catch(() => null);
    if (postgresResult) return actionSuccess(postgresResult);
    return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับตรวจระบบ");
  }

  const tables = await Promise.all(
    requiredTables.map(async (table) => {
      try {
        const { error: tableError } = await withTimeout(client.from(table).select("*").limit(1), 6000, `ตรวจตาราง ${table}`);
        return {
          table,
          ok: !tableError,
          message: tableError ? getSupabaseConnectionMessage(tableError) : "พร้อมใช้งาน"
        };
      } catch (tableError) {
        return {
          table,
          ok: false,
          message: getSupabaseConnectionMessage(tableError)
        };
      }
    })
  );

  return actionSuccess({
    mode,
    checkedAt: new Date().toISOString(),
    tables,
    ready: tables.every((row) => row.ok)
  });
}

export async function createProductionPilotSmokeScenarioAction(): Promise<ActionResult> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) {
    const postgresResult = await withTimeout(createPilotScenarioViaPostgres(), 7000, "pilot scenario fallback").catch(() => null);
    if (postgresResult) return actionSuccess(postgresResult);
    return actionFailure(error || "ยังไม่ได้ตั้งค่า Supabase สำหรับสร้างชุดทดสอบ");
  }

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

  const projectCode = `PILOT-${suffix}`;
  const callSignCode = `PILOT-${suffix.slice(-4)}`;
  const vehiclePlate = `TEST-${suffix.slice(-4)}`;
  const projectName = `ทดสอบ Pilot ${suffix}`;
  const missionName = "รับส่งทดสอบระบบ";
  const pickupLocation = "จุดรับผู้โดยสาร";
  const dropoffLocation = "จุดส่งปลายทาง";
  const commitmentTime = new Date(startTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  const project = {
    ...baseRecord(ids.project),
    organizationId: ids.organization,
    ownerProfileId: ids.profile,
    projectCode,
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
    metadata: { pickupLocation, dropoffLocation, commitmentTime, coordinatorPhone: "+6620000000", operationPhone: "+6621111111" }
  };
  const callSign = { ...baseRecord(ids.callSign), projectId: ids.project, callSign: callSignCode, groupName: "ทดสอบ Pilot", status: "active" as const };
  const driver = { ...baseRecord(ids.driver), organizationId: ids.organization, vendorId: null, fullName: "คนขับทดสอบ Pilot", phone: "+66810000000", licenseType: "pilot", languages: ["th"], status: "assigned" as const };
  const vehicle = { ...baseRecord(ids.vehicle), organizationId: ids.organization, vendorId: null, plateNumber: vehiclePlate, vehicleType: "รถทดสอบ", capacity: 4, status: "assigned" as const };
  const packet = buildWebDriverAssignmentPacket({ project, assignment, callSign, driver, vehicle, missionName });
  const expiresAt = getDefaultDriverTokenExpiry();
  const token = generateDriverAccessToken({ assignmentId: ids.assignment, driverId: ids.driver, expiresAt });
  const smokePin = generateDriverPin();

  const steps: InsertStep[] = [
    {
      label: "สร้างองค์กรทดสอบ",
      run: () =>
        client.from("organizations").insert({
          id: ids.organization,
          name: "TOMP Internal Pilot",
          organization_type: "operator",
          status: "active",
          metadata: { smokeTest: true }
        })
    },
    {
      label: "สร้างผู้ดูแลทดสอบ",
      run: () =>
        client.from("profiles").insert({
          id: ids.profile,
          auth_user_id: null,
          organization_id: ids.organization,
          full_name: "ผู้ดูแลทดสอบ Pilot",
          email: `pilot-${suffix}@example.com`,
          phone: "+6620000000",
          status: "active",
          metadata: { smokeTest: true }
        })
    },
    {
      label: "สร้างโครงการทดสอบ",
      run: () =>
        client.from("projects").insert({
          id: ids.project,
          organization_id: ids.organization,
          owner_profile_id: ids.profile,
          project_code: projectCode,
          project_name: projectName,
          start_date: today,
          end_date: today,
          timezone: "Asia/Bangkok",
          status: "planning",
          visibility_level: "internal",
          service_level: "standard",
          metadata: { smokeTest: true }
        })
    },
    {
      label: "สร้างวันปฏิบัติการ",
      run: () =>
        client.from("project_days").insert({
          id: ids.day,
          project_id: ids.project,
          operation_date: today,
          day_number: 1,
          timezone: "Asia/Bangkok",
          status: "draft",
          metadata: { smokeTest: true }
        })
    },
    {
      label: "สร้างรอบปฏิบัติการ",
      run: () =>
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
        })
    },
    {
      label: "สร้างภารกิจ",
      run: () =>
        client.from("missions").insert({
          id: ids.mission,
          project_id: ids.project,
          project_day_id: ids.day,
          session_id: ids.session,
          mission_code: `MIS-${suffix}`,
          mission_name: missionName,
          mission_type: "driver_tracking_test",
          priority: "normal",
          status: "draft",
          planned_start_time: startTime,
          planned_end_time: endTime,
          instruction: "ให้คนขับเปิดหน้าคนขับและแชร์ GPS",
          service_commitment: "ศูนย์ควบคุมต้องเห็นตำแหน่งล่าสุด",
          metadata: { pickupLocation, dropoffLocation, commitmentTime }
        })
    },
    {
      label: "สร้าง Call Sign",
      run: () =>
        client.from("call_signs").insert({
          id: ids.callSign,
          project_id: ids.project,
          call_sign: callSignCode,
          group_name: "ทดสอบ Pilot",
          status: "active",
          metadata: { smokeTest: true }
        })
    },
    {
      label: "สร้างรถ",
      run: () =>
        client.from("vehicles").insert({
          id: ids.vehicle,
          organization_id: ids.organization,
          vendor_id: null,
          plate_number: vehiclePlate,
          vehicle_type: "รถทดสอบ",
          capacity: 4,
          status: "assigned",
          metadata: { smokeTest: true }
        })
    },
    {
      label: "สร้างคนขับ",
      run: () =>
        client.from("drivers").insert({
          id: ids.driver,
          organization_id: ids.organization,
          vendor_id: null,
          full_name: driver.fullName,
          phone: driver.phone,
          license_type: "pilot",
          languages: ["th"],
          status: "assigned",
          metadata: { smokeTest: true }
        })
    },
    {
      label: "สร้าง Assignment",
      run: () =>
        client
          .from("call_signs")
          .update({
            driver_id: ids.driver,
            vehicle_id: ids.vehicle,
            metadata: { smokeTest: true, crewedUnit: true }
          })
          .eq("id", ids.callSign)
          .eq("project_id", ids.project)
    },
    {
      label: "สร้าง Assignment",
      run: () =>
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
          metadata: assignment.metadata
        })
    }
  ];

  for (const step of steps) {
    const failure = await runInsertStep(step);
    if (failure) return actionFailure(failure);
  }

  const tokenResult = await withTimeout(
    client
      .from("driver_access_tokens")
      .insert({
        project_id: ids.project,
        assignment_id: ids.assignment,
        driver_id: ids.driver,
        token_hash: hashDriverAccessToken(token),
        status: "active",
        expires_at: expiresAt,
        // Test tokens carry a PIN too, so the smoke flow exercises the same
        // two-factor gate the real QR flow uses.
        metadata: { smokeTest: true, tokenVersion: 2, pinHash: hashDriverPin(smokePin), pinAttempts: 0 }
      })
      .select("id")
      .single(),
    5000,
    "สร้าง QR/token"
  ).catch((insertError) => ({ data: null, error: insertError }));
  if (tokenResult.error) return actionFailure(getDatabaseErrorMessage(tokenResult.error, "สร้าง QR ไม่สำเร็จ"));

  const packetResult = await withTimeout(
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
    5000,
    "สร้าง assignment packet"
  ).catch((insertError) => ({ data: null, error: insertError }));
  if (packetResult.error) return actionFailure(getDatabaseErrorMessage(packetResult.error, "สร้าง assignment packet ไม่สำเร็จ"));

  const [notificationResult, routeChangeResult, timelineResult] = await Promise.all([
    withTimeout(
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
      5000,
      "สร้าง notification"
    ).catch((insertError) => ({ error: insertError })),
    withTimeout(
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
      }),
      5000,
      "สร้าง route change"
    ).catch((insertError) => ({ error: insertError })),
    withTimeout(
      client.from("timeline_events").insert({
        project_id: ids.project,
        object_type: "assignment",
        object_id: ids.assignment,
        event_type: TIMELINE_EVENTS.DRIVER_ACCESS_TOKEN_CREATED,
        source: "operation_user",
        reason: "สร้างชุดทดสอบ Production Pilot Smoke Test",
        after_data: { tokenId: tokenResult.data?.id, packetId: packetResult.data?.id },
        metadata: { smokeTest: true }
      }),
      5000,
      "สร้าง Timeline"
    ).catch((insertError) => ({ error: insertError }))
  ]);

  if (notificationResult.error) return actionFailure(getDatabaseErrorMessage(notificationResult.error, "สร้าง notification ไม่สำเร็จ"));
  if (routeChangeResult.error) return actionFailure(getDatabaseErrorMessage(routeChangeResult.error, "สร้าง route change ไม่สำเร็จ"));
  if (timelineResult.error) return actionFailure(getDatabaseErrorMessage(timelineResult.error, "สร้าง Timeline ไม่สำเร็จ"));

  return actionSuccess({
    projectId: ids.project,
    assignmentId: ids.assignment,
    driverId: ids.driver,
    accessUrl: buildDriverAccessUrl(token, await getRequestBaseUrl()),
    pin: smokePin,
    missionControlUrl: `/mission-control?projectId=${ids.project}`,
    assignmentsUrl: `/projects/${ids.project}/assignments`,
    packetId: packetResult.data?.id,
    tokenId: tokenResult.data?.id
  });
}
