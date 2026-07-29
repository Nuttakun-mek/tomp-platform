import "server-only";

import { randomUUID } from "crypto";
import { buildWebDriverAssignmentPacket } from "@/lib/driver/assignment-packet";
import { generateDriverAccessToken, getDefaultDriverTokenExpiry, hashDriverAccessToken } from "@/lib/driver-access/token";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { getRequestBaseUrl } from "@/lib/request-origin";
import { getPostgresClient } from "./postgres";

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

function jsonb(value: unknown) {
  return JSON.stringify(value);
}

function getPostgresPilotErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("tenant/user") || message.includes("ENOTFOUND")) {
    return "เชื่อมต่อฐานข้อมูลจริงไม่ได้: Supabase pooler ไม่พบ project/tenant นี้ กรุณาตรวจว่า Project ยัง active และคัดลอก Connection string จากหน้า Supabase Dashboard อีกครั้ง";
  }
  if (message.toLowerCase().includes("password") || message.includes("28P01")) {
    return "เชื่อมต่อฐานข้อมูลจริงไม่ได้: รหัสผ่านฐานข้อมูลไม่ถูกต้อง กรุณาตรวจ Database password หรือ reset password ใน Supabase";
  }
  if (message.toLowerCase().includes("timeout")) {
    return "เชื่อมต่อฐานข้อมูลจริงไม่ได้: การเชื่อมต่อหมดเวลา กรุณาตรวจ network และ Supabase project status";
  }
  return message || "ตรวจตารางไม่สำเร็จ";
}

export async function checkPilotInfrastructureViaPostgres() {
  const sql = getPostgresClient();
  if (!sql) return null;

  const tables = [];
  for (const table of requiredTables) {
    try {
      await sql`select 1 from ${sql(table)} limit 1`;
      tables.push({ table, ok: true, message: "พร้อมใช้งานผ่าน Postgres" });
    } catch (error) {
      tables.push({ table, ok: false, message: getPostgresPilotErrorMessage(error) });
    }
  }

  return {
    mode: "postgres_direct",
    checkedAt: new Date().toISOString(),
    tables,
    ready: tables.every((row) => row.ok)
  };
}

export async function createPilotScenarioViaPostgres() {
  const sql = getPostgresClient();
  if (!sql) return null;

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
    assignment: randomUUID(),
    token: randomUUID(),
    packet: randomUUID(),
    timeline: randomUUID()
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

  await sql.begin(async (tx) => {
    await tx`insert into organizations (id, name, organization_type, status, metadata) values (${ids.organization}, ${"TOMP Internal Pilot"}, ${"operator"}, ${"active"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into profiles (id, auth_user_id, organization_id, full_name, email, phone, status, metadata) values (${ids.profile}, null, ${ids.organization}, ${"ผู้ดูแลทดสอบ Pilot"}, ${`pilot-${suffix}@example.com`}, ${"+6620000000"}, ${"active"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into projects (id, organization_id, owner_profile_id, project_code, project_name, start_date, end_date, timezone, status, visibility_level, service_level, metadata) values (${ids.project}, ${ids.organization}, ${ids.profile}, ${projectCode}, ${projectName}, ${today}, ${today}, ${"Asia/Bangkok"}, ${"planning"}, ${"internal"}, ${"standard"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into project_days (id, project_id, operation_date, day_number, timezone, status, metadata) values (${ids.day}, ${ids.project}, ${today}, ${1}, ${"Asia/Bangkok"}, ${"draft"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into sessions (id, project_id, project_day_id, session_name, session_type, start_time, end_time, status, metadata) values (${ids.session}, ${ids.project}, ${ids.day}, ${"รอบทดสอบ Pilot"}, ${"pilot_smoke_test"}, ${startTime}, ${endTime}, ${"draft"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into missions (id, project_id, project_day_id, session_id, mission_code, mission_name, mission_type, priority, status, planned_start_time, planned_end_time, instruction, service_commitment, metadata) values (${ids.mission}, ${ids.project}, ${ids.day}, ${ids.session}, ${`MIS-${suffix}`}, ${missionName}, ${"driver_tracking_test"}, ${"normal"}, ${"draft"}, ${startTime}, ${endTime}, ${"ให้คนขับเปิดหน้าคนขับและแชร์ GPS"}, ${"ศูนย์ควบคุมต้องเห็นตำแหน่งล่าสุด"}, ${jsonb({ pickupLocation, dropoffLocation, commitmentTime })}::jsonb)`;
    await tx`insert into call_signs (id, project_id, call_sign, group_name, status, metadata) values (${ids.callSign}, ${ids.project}, ${callSignCode}, ${"ทดสอบ Pilot"}, ${"active"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into vehicles (id, organization_id, vendor_id, plate_number, vehicle_type, capacity, status, metadata) values (${ids.vehicle}, ${ids.organization}, null, ${vehiclePlate}, ${"รถทดสอบ"}, ${4}, ${"assigned"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into drivers (id, organization_id, vendor_id, full_name, phone, license_type, languages, status, metadata) values (${ids.driver}, ${ids.organization}, null, ${"คนขับทดสอบ Pilot"}, ${"+66810000000"}, ${"pilot"}, ARRAY[${"th"}], ${"assigned"}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into assignments (id, project_id, mission_id, call_sign_id, vehicle_id, driver_id, status, start_time, end_time, current_version, metadata) values (${ids.assignment}, ${ids.project}, ${ids.mission}, ${ids.callSign}, ${ids.vehicle}, ${ids.driver}, ${"planned"}, ${startTime}, ${endTime}, ${1}, ${jsonb(assignment.metadata)}::jsonb)`;
    await tx`insert into driver_access_tokens (id, project_id, assignment_id, driver_id, token_hash, status, expires_at, metadata) values (${ids.token}, ${ids.project}, ${ids.assignment}, ${ids.driver}, ${hashDriverAccessToken(token)}, ${"active"}, ${expiresAt}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into driver_assignment_packets (id, project_id, assignment_id, driver_id, packet_version, payload, published_at, metadata) values (${ids.packet}, ${ids.project}, ${ids.assignment}, ${ids.driver}, ${1}, ${jsonb(packet)}::jsonb, ${new Date().toISOString()}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into driver_notifications (project_id, assignment_id, driver_id, notification_type, priority, title, body, action_label, status, sent_at, metadata) values (${ids.project}, ${ids.assignment}, ${ids.driver}, ${"assignment_created"}, ${"normal"}, ${"งานใหม่"}, ${"กรุณาตรวจสอบรายละเอียดงานและกดรับทราบ"}, ${"รับทราบ"}, ${"unread"}, ${new Date().toISOString()}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into route_change_instructions (project_id, assignment_id, requested_by, approved_by, old_route, new_route, reason, impact_summary, status, sent_to_driver_at, metadata) values (${ids.project}, ${ids.assignment}, ${ids.profile}, null, null, ${jsonb(packet.routeInstruction.routePlan)}::jsonb, ${"ทดสอบการแจ้งเปลี่ยนเส้นทาง"}, ${"คนขับต้องกดรับทราบก่อนเดินทางต่อ"}, ${"pending"}, ${new Date().toISOString()}, ${jsonb({ smokeTest: true })}::jsonb)`;
    await tx`insert into timeline_events (id, project_id, object_type, object_id, event_type, source, reason, after_data, metadata) values (${ids.timeline}, ${ids.project}, ${"assignment"}, ${ids.assignment}, ${"DRIVER_ACCESS_TOKEN_CREATED"}, ${"operation_user"}, ${"สร้างชุดทดสอบ Production Pilot ผ่าน Postgres fallback"}, ${jsonb({ tokenId: ids.token, packetId: ids.packet })}::jsonb, ${jsonb({ smokeTest: true, source: "postgres_direct" })}::jsonb)`;
  });

  return {
    projectId: ids.project,
    assignmentId: ids.assignment,
    driverId: ids.driver,
    accessUrl: buildDriverAccessUrl(token, await getRequestBaseUrl()),
    missionControlUrl: `/mission-control?projectId=${ids.project}`,
    assignmentsUrl: `/projects/${ids.project}/assignments`,
    packetId: ids.packet,
    tokenId: ids.token
  };
}
